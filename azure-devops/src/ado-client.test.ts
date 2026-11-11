import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { AdoRequestError, createAdoClient } from "./ado-client.ts";

const PULL_REQUEST = { project: "my project", repository: "my-repo", pullRequestId: 42 };

function fakeAdo(respond: (url: string) => Response) {
  const requests: { url: string; init: RequestInit }[] = [];
  const client = createAdoClient({
    origin: "https://dev.azure.com",
    apiBasePath: "/my-org",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return respond(url);
    },
  });
  return { client, requests };
}

const respondWithEvaluations = (url: string) =>
  url.includes("/_apis/projects/") ? Response.json({ id: "project-guid" }) : Response.json({ value: [{ status: "approved" }] });

test("fetches the evaluations of a pull request by project id", async () => {
  const { client, requests } = fakeAdo(respondWithEvaluations);
  const response = await client.getPolicyEvaluations(PULL_REQUEST);

  assert.deepEqual(response, { evaluations: [{ status: "approved" }], retryAfterSeconds: null });
  assert.deepEqual(requests.map((request) => request.url), [
    "https://dev.azure.com/my-org/_apis/projects/my%20project?api-version=7.1",
    "https://dev.azure.com/my-org/project-guid/_apis/policy/evaluations?artifactId=vstfs%3A%2F%2F%2FCodeReview%2FCodeReviewId%2Fproject-guid%2F42&api-version=7.1-preview.1",
  ]);
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
  assert.equal((await client.getPolicyEvaluations(PULL_REQUEST)).evaluations.length, 1);
});

test("reports Retry-After on success and on failure", async () => {
  const slowedDown = fakeAdo((url) => url.includes("/_apis/projects/")
    ? Response.json({ id: "project-guid" })
    : Response.json({ value: [] }, { headers: { "Retry-After": "30" } }));
  assert.equal((await slowedDown.client.getPolicyEvaluations(PULL_REQUEST)).retryAfterSeconds, 30);

  const blocked = fakeAdo(() => new Response("", { status: 429, headers: { "Retry-After": "12" } }));
  await assert.rejects(blocked.client.getPolicyEvaluations(PULL_REQUEST), (error: AdoRequestError) =>
    error.httpStatus === 429 && error.retryAfterSeconds === 12);
});

test("sends GET requests only", async () => {
  const { client, requests } = fakeAdo(respondWithEvaluations);
  await client.getPolicyEvaluations(PULL_REQUEST);
  assert.deepEqual([...new Set(requests.map((request) => request.init.method))], ["GET"]);
});

test("the extension source has one fetch call and no write methods", () => {
  const sourceDirectory = new URL(".", import.meta.url);
  const sourceFiles = readdirSync(sourceDirectory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  const source = sourceFiles.map((name) => readFileSync(new URL(name, sourceDirectory), "utf8")).join("\n");

  assert.equal(source.match(/\bfetch\(/g)?.length, 2, "one call in ado-client.ts and the browser fetch passed in by content.ts");
  assert.doesNotMatch(source, /["'`](POST|PUT|PATCH|DELETE)["'`]/i);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/);
});

test("fetches the pull requests of a repository list", async () => {
  const { client, requests } = fakeAdo(() => Response.json({ value: [{ pullRequestId: 42 }] }));
  const response = await client.getPullRequests({ project: "my project", repository: "my-repo", status: "completed" });

  assert.deepEqual(response, { pullRequests: [{ pullRequestId: 42 }], retryAfterSeconds: null });
  assert.deepEqual(requests.map((request) => `${request.init.method} ${request.url}`), [
    "GET https://dev.azure.com/my-org/my%20project/_apis/git/repositories/my-repo/pullrequests?searchCriteria.status=completed&$top=200&api-version=7.1",
  ]);
});

test("fetches work items in batches of 200", async () => {
  const { client, requests } = fakeAdo((url) => {
    const ids = new URL(url).searchParams.get("ids")!.split(",").map(Number);
    return Response.json({ value: ids.map((id) => id === 3 ? null : { id, rev: 7, fields: { "System.ChangedBy": { id: "kestrel" } } }) });
  });
  const ids = Array.from({ length: 201 }, (_, index) => index + 1);
  const { workItems } = await client.getWorkItems(ids);

  assert.equal(requests.length, 2);
  assert.match(requests[0]!.url, /^https:\/\/dev\.azure\.com\/my-org\/_apis\/wit\/workitems\?ids=1,2,3,.*,200&fields=System\.Rev,System\.ChangedBy&errorPolicy=Omit&api-version=7\.1$/);
  assert.match(requests[1]!.url, /\?ids=201&/);
  assert.equal(workItems.length, 200, "the deleted work item 3 is left out");
  assert.deepEqual(workItems[0], { id: 1, rev: 7, changedById: "kestrel" });
});

test("asks who is signed in once, and gives null when that fails", async () => {
  const signedIn = fakeAdo(() => Response.json({ authenticatedUser: { id: "my-user-id" } }));
  assert.equal(await signedIn.client.getAuthenticatedUserId(), "my-user-id");
  assert.equal(await signedIn.client.getAuthenticatedUserId(), "my-user-id");
  assert.deepEqual(signedIn.requests.map((request) => `${request.init.method} ${request.url}`), ["GET https://dev.azure.com/my-org/_apis/connectionData"]);

  const failing = fakeAdo(() => new Response("", { status: 500 }));
  assert.equal(await failing.client.getAuthenticatedUserId(), null);
});
