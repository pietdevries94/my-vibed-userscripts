import { AdoRequestError, createAdoClient } from "./ado-client.ts";
import { readFileSync, readdirSync } from "node:fs";
import type { AdoClient } from "./ado-client.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const PULL_REQUEST = { project: "my project", pullRequestId: 42, repository: "my-repo" };

interface FakeAdo {
  client: AdoClient;
  requests: { url: string; init: RequestInit }[];
}

function fakeAdo(respond: (url: string) => Response): FakeAdo {
  const requests: { url: string; init: RequestInit }[] = [];
  const client = createAdoClient({
    apiBasePath: "/my-org",
    fetch: async (url, init) => {
      requests.push({ init, url });
      return respond(url);
    },
    origin: "https://dev.azure.com",
  });
  return { client, requests };
}

const respondWithEvaluations = (url: string): Response =>
  url.includes("/_apis/projects/")
    ? Response.json({ id: "project-guid" })
    : Response.json({ value: [{ status: "approved" }] });

test("fetches the evaluations of a pull request by project id", async () => {
  const { client, requests } = fakeAdo(respondWithEvaluations);
  const response = await client.getPolicyEvaluations(PULL_REQUEST);

  assert.deepEqual(response, { evaluations: [{ status: "approved" }], retryAfterSeconds: null });
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://dev.azure.com/my-org/_apis/projects/my%20project?api-version=7.1",
      "https://dev.azure.com/my-org/project-guid/_apis/policy/evaluations?artifactId=vstfs%3A%2F%2F%2FCodeReview%2FCodeReviewId%2Fproject-guid%2F42&api-version=7.1-preview.1",
    ],
  );
});

test("looks up a project id once", async () => {
  const { client, requests } = fakeAdo(respondWithEvaluations);
  await client.getPolicyEvaluations(PULL_REQUEST);
  await client.getPolicyEvaluations({ ...PULL_REQUEST, pullRequestId: 43 });
  assert.equal(requests.filter((request) => request.url.includes("/_apis/projects/")).length, 1);
});

test("retries the project lookup after it failed", async () => {
  let isFirstRequest = true;
  const { client } = fakeAdo((url) => {
    if (isFirstRequest) {
      isFirstRequest = false;
      return new Response("", { status: 500 });
    }
    return respondWithEvaluations(url);
  });
  await assert.rejects(client.getPolicyEvaluations(PULL_REQUEST), AdoRequestError);
  const { evaluations } = await client.getPolicyEvaluations(PULL_REQUEST);
  assert.equal(evaluations.length, 1);
});

test("reports Retry-After on success and on failure", async () => {
  const slowedDown = fakeAdo((url) =>
    url.includes("/_apis/projects/")
      ? Response.json({ id: "project-guid" })
      : Response.json({ value: [] }, { headers: { "Retry-After": "30" } }),
  );
  const { retryAfterSeconds } = await slowedDown.client.getPolicyEvaluations(PULL_REQUEST);
  assert.equal(retryAfterSeconds, 30);

  const blocked = fakeAdo(
    () => new Response("", { headers: { "Retry-After": "12" }, status: 429 }),
  );
  await assert.rejects(
    blocked.client.getPolicyEvaluations(PULL_REQUEST),
    (error: AdoRequestError) => error.httpStatus === 429 && error.retryAfterSeconds === 12,
  );
});

test("reads with GET requests", async () => {
  const { client, requests } = fakeAdo(respondWithEvaluations);
  await client.getPolicyEvaluations(PULL_REQUEST);
  assert.deepEqual([...new Set(requests.map((request) => request.init.method))], ["GET"]);
});

test("the script source has one fetch call and no write methods", () => {
  const sourceDirectory = new URL(".", import.meta.url);
  const sourceFiles = readdirSync(sourceDirectory).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );
  const source = sourceFiles
    .map((name) => readFileSync(new URL(name, sourceDirectory), "utf8"))
    .join("\n");

  assert.equal(
    source.match(/\bfetch\(/gu)?.length,
    2,
    "one call in ado-request.ts and the browser fetch passed in by main.ts",
  );
  const writes = sourceFiles.flatMap((name) =>
    [
      ...readFileSync(new URL(name, sourceDirectory), "utf8").matchAll(
        /["'`](?<method>POST|PUT|PATCH|DELETE)["'`]/giu,
      ),
    ].map((match) => `${name} ${match.groups?.method ?? ""}`),
  );
  assert.deepEqual(
    writes,
    [
      "ado-client.ts PATCH",
      "ado-client.ts PATCH",
      "ado-request.ts PATCH",
      "ado-request.ts POST",
      "ado-request.ts PUT",
      "reviewer-requests.ts PUT",
      "reviewer-requests.ts POST",
    ],
    "only the re-queue of a build check, the cancel of a run, adding a reviewer and the identity search (a POST that reads) write",
  );
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/u);
});

test("re-queues a build check of a pull request with one PATCH", async () => {
  const { client, requests } = fakeAdo((url) =>
    url.includes("/_apis/projects/")
      ? Response.json({ id: "project-guid" })
      : Response.json({ status: "queued" }),
  );
  await client.requeuePolicyEvaluation("my project", "evaluation-guid");

  const requeue = requests.at(-1);
  assert.equal(
    `${requeue?.init.method} ${requeue?.url}`,
    "PATCH https://dev.azure.com/my-org/project-guid/_apis/policy/evaluations/evaluation-guid?api-version=7.1-preview.1",
  );
  assert.equal(requeue?.init.body, JSON.stringify({ status: "queued" }));
  assert.deepEqual(requeue?.init.headers, {
    Accept: "application/json",
    "Content-Type": "application/json",
  });
});

test("cancels a run with one PATCH", async () => {
  const { client, requests } = fakeAdo(() => Response.json({ status: "cancelling" }));
  await client.cancelBuild("my project", 812);

  const [cancel] = requests;
  assert.equal(
    `${cancel?.init.method} ${cancel?.url}`,
    "PATCH https://dev.azure.com/my-org/my%20project/_apis/build/builds/812?api-version=7.1",
  );
  assert.equal(cancel?.init.body, JSON.stringify({ status: "cancelling" }));
});

test("a refused re-queue throws", async () => {
  const { client } = fakeAdo((url) =>
    url.includes("/_apis/projects/")
      ? Response.json({ id: "project-guid" })
      : new Response("", { status: 403 }),
  );
  await assert.rejects(
    client.requeuePolicyEvaluation("my project", "evaluation-guid"),
    AdoRequestError,
  );
});

test("fetches the pull requests of a repository list", async () => {
  const { client, requests } = fakeAdo(() => Response.json({ value: [{ pullRequestId: 42 }] }));
  const response = await client.getPullRequests({
    project: "my project",
    repository: "my-repo",
    status: "completed",
  });

  assert.deepEqual(response, { pullRequests: [{ pullRequestId: 42 }], retryAfterSeconds: null });
  assert.deepEqual(
    requests.map((request) => `${request.init.method} ${request.url}`),
    [
      "GET https://dev.azure.com/my-org/my%20project/_apis/git/repositories/my-repo/pullrequests?searchCriteria.status=completed&$top=200&api-version=7.1",
    ],
  );
});

test("fetches work items in batches of 200", async () => {
  const { client, requests } = fakeAdo((url) => {
    const ids = (new URL(url).searchParams.get("ids") ?? "").split(",").map(Number);
    return Response.json({
      value: ids.map((id) =>
        id === 3 ? null : { fields: { "System.ChangedBy": { id: "kestrel" } }, id, rev: 7 },
      ),
    });
  });
  const ids = Array.from({ length: 201 }, (_entry, index) => index + 1);
  const { workItems } = await client.getWorkItems(ids);

  assert.equal(requests.length, 2);
  assert.match(
    requests[0].url,
    /^https:\/\/dev\.azure\.com\/my-org\/_apis\/wit\/workitems\?ids=1,2,3,.*,200&fields=System\.Rev,System\.ChangedBy&errorPolicy=Omit&api-version=7\.1$/u,
  );
  assert.match(requests[1].url, /\?ids=201&/u);
  assert.equal(workItems.length, 200, "the deleted work item 3 is left out");
  assert.deepEqual(workItems[0], { changedById: "kestrel", id: 1, rev: 7 });
});

test("fetches every update of a work item, 200 at a time", async () => {
  const { client, requests } = fakeAdo((url) => {
    const skip = Number(new URL(url).searchParams.get("$skip"));
    const count = skip === 0 ? 200 : 3;
    return Response.json({
      count,
      value: Array.from({ length: count }, (_entry, index) => ({ id: skip + index + 1 })),
    });
  });
  const { updates } = await client.getWorkItemUpdates(42);

  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://dev.azure.com/my-org/_apis/wit/workItems/42/updates?$top=200&$skip=0&api-version=7.1",
      "https://dev.azure.com/my-org/_apis/wit/workItems/42/updates?$top=200&$skip=200&api-version=7.1",
    ],
  );
  assert.equal(updates.length, 203);
});

test("asks who is signed in once, and gives null when that fails", async () => {
  const signedIn = fakeAdo(() => Response.json({ authenticatedUser: { id: "my-user-id" } }));
  assert.equal(await signedIn.client.getAuthenticatedUserId(), "my-user-id");
  assert.equal(await signedIn.client.getAuthenticatedUserId(), "my-user-id");
  assert.deepEqual(
    signedIn.requests.map((request) => `${request.init.method} ${request.url}`),
    ["GET https://dev.azure.com/my-org/_apis/connectionData"],
  );

  const failing = fakeAdo(() => new Response("", { status: 500 }));
  assert.equal(await failing.client.getAuthenticatedUserId(), null);
});

test("fetches the timeline of a pipeline run", async () => {
  const record = { id: "step-guid", name: "npm test", type: "Task" };
  const { client, requests } = fakeAdo(() => Response.json({ records: [record] }));
  const response = await client.getTimeline("my project", 812);

  assert.deepEqual(response, { records: [record], retryAfterSeconds: null });
  assert.deepEqual(
    requests.map((request) => `${request.init.method} ${request.url}`),
    [
      "GET https://dev.azure.com/my-org/my%20project/_apis/build/builds/812/timeline?api-version=7.1",
    ],
  );
});

test("a run without a timeline yet has no records", async () => {
  const { client } = fakeAdo(() => new Response("null", { status: 200 }));
  assert.deepEqual(await client.getTimeline("my project", 812), {
    records: [],
    retryAfterSeconds: null,
  });
});

test("fetches the runs of a pull request, newest first", async () => {
  const build = { buildNumber: "20310402.3", id: 812, status: "completed" };
  const { client, requests } = fakeAdo(() => Response.json({ value: [build] }));
  const response = await client.getPullRequestBuilds("my project", 42);

  assert.deepEqual(response, { builds: [build], retryAfterSeconds: null });
  assert.deepEqual(
    requests.map((request) => `${request.init.method} ${request.url}`),
    [
      "GET https://dev.azure.com/my-org/my%20project/_apis/build/builds?branchName=refs%2Fpull%2F42%2Fmerge&queryOrder=queueTimeDescending&$top=50&api-version=7.1",
    ],
  );
});
