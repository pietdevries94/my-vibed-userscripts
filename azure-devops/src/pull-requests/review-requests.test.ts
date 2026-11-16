import assert from "node:assert/strict";
import { createAdoClient } from "../core/ado-client.ts";
import { test } from "node:test";

const PULL_REQUEST = { project: "my project", pullRequestId: 42, repository: "my-repo" };
const PULL_REQUEST_URL =
  "https://dev.azure.com/my-org/my%20project/_apis/git/repositories/my-repo/pullRequests/42";
const SERVER_PAGE_SIZE = 100;

interface SentRequest {
  url: string;
  method: string | undefined;
  body: unknown;
}

function fakeAdo(respond: (url: string) => Response): {
  client: ReturnType<typeof createAdoClient>;
  requests: SentRequest[];
} {
  const requests: SentRequest[] = [];
  const client = createAdoClient({
    apiBasePath: "/my-org",
    fetch: async (url, init) => {
      const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : null;
      requests.push({ body, method: init.method, url });
      return respond(url);
    },
    origin: "https://dev.azure.com",
  });
  return { client, requests };
}

test("a thread on a line is posted as Azure DevOps's own comment box posts it", async () => {
  const { client, requests } = fakeAdo(() => Response.json({ id: 7 }));
  const threadId = await client.createPullRequestThread(PULL_REQUEST, {
    content: "Why not sum here?",
    iteration: { changeTrackingId: 2, id: 3 },
    threadContext: {
      filePath: "/src/totals.ts",
      rightFileEnd: { line: 12, offset: 31 },
      rightFileStart: { line: 12, offset: 1 },
    },
  });
  assert.equal(threadId, 7);
  assert.deepEqual(requests, [
    {
      body: {
        comments: [{ commentType: 1, content: "Why not sum here?", parentCommentId: 0 }],
        pullRequestThreadContext: {
          changeTrackingId: 2,
          iterationContext: { firstComparingIteration: 3, secondComparingIteration: 3 },
        },
        status: 1,
        threadContext: {
          filePath: "/src/totals.ts",
          rightFileEnd: { line: 12, offset: 31 },
          rightFileStart: { line: 12, offset: 1 },
        },
      },
      method: "POST",
      url: `${PULL_REQUEST_URL}/threads?api-version=7.1`,
    },
  ]);
});

test("a comment on the pull request as a whole is a thread without a place", async () => {
  const { client, requests } = fakeAdo(() => Response.json({ id: 8 }));
  await client.createPullRequestThread(PULL_REQUEST, { content: "Looks good overall." });
  assert.deepEqual(requests[0]?.body, {
    comments: [{ commentType: 1, content: "Looks good overall.", parentCommentId: 0 }],
    status: 1,
  });
});

test("a vote is one PUT on the reviewer, with only the vote", async () => {
  const { client, requests } = fakeAdo(() => Response.json({}));
  await client.setPullRequestVote(PULL_REQUEST, { reviewerId: "id me", vote: -5 });
  assert.deepEqual(requests, [
    {
      body: { vote: -5 },
      method: "PUT",
      url: `${PULL_REQUEST_URL}/reviewers/id%20me?api-version=7.1`,
    },
  ]);
});

test("the changed files of an iteration are read page by page", async () => {
  // Azure DevOps gives fewer files than asked for, and names where the next page starts.
  const firstPage = Array.from({ length: SERVER_PAGE_SIZE }, (_unused, index) => ({
    changeTrackingId: index + 1,
  }));
  const { client, requests } = fakeAdo((url) =>
    Response.json(
      url.includes("$skip=0&")
        ? { changeEntries: firstPage, nextSkip: SERVER_PAGE_SIZE, nextTop: SERVER_PAGE_SIZE }
        : { changeEntries: [{ changeTrackingId: SERVER_PAGE_SIZE + 1 }] },
    ),
  );
  const changes = await client.getIterationChanges(PULL_REQUEST, 3);
  assert.equal(changes.length, SERVER_PAGE_SIZE + 1);
  assert.deepEqual(
    requests.map(({ url }) => url),
    [
      `${PULL_REQUEST_URL}/iterations/3/changes?$top=500&$skip=0&api-version=7.1`,
      `${PULL_REQUEST_URL}/iterations/3/changes?$top=100&$skip=100&api-version=7.1`,
    ],
  );
});

test("threads, iteration ids and the status are read with GET requests", async () => {
  const { client, requests } = fakeAdo((url) => {
    if (url.includes("/iterations?")) {
      return Response.json({ value: [{ id: 1 }, { id: 2 }] });
    }
    return url.includes("/threads?")
      ? Response.json({ value: [{ comments: [{ content: "Hi" }], id: 5 }] })
      : Response.json({ status: "completed" });
  });
  assert.deepEqual(await client.getPullRequestIterationIds(PULL_REQUEST), [1, 2]);
  assert.deepEqual(await client.getPullRequestThreads(PULL_REQUEST), [
    { comments: [{ content: "Hi" }], id: 5 },
  ]);
  assert.equal(await client.getPullRequestStatus(PULL_REQUEST), "completed");
  assert.deepEqual([...new Set(requests.map(({ method }) => method))], ["GET"]);
});
