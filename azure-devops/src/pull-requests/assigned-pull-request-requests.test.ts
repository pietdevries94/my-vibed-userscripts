import type { AssignedPullRequestRequests } from "./assigned-pull-request-requests.ts";
import assert from "node:assert/strict";
import { createAssignedPullRequestRequests } from "./assigned-pull-request-requests.ts";
import { test } from "node:test";

function fakeAdo(): { requests: string[]; client: AssignedPullRequestRequests } {
  const requests: string[] = [];
  const client = createAssignedPullRequestRequests({
    apiBasePath: "/my-org",
    fetch: async (url, init) => {
      requests.push(`${init.method} ${url}`);
      return Response.json({ value: [{ pullRequestId: 42 }] });
    },
    origin: "https://dev.azure.com",
  });
  return { client, requests };
}

test("fetches the active pull requests of a repository with the user as a reviewer", async () => {
  const { client, requests } = fakeAdo();
  const response = await client.getPullRequestsAssignedTo("kestrel", {
    project: "my project",
    repository: "my-repo",
  });

  assert.deepEqual(response, { pullRequests: [{ pullRequestId: 42 }], retryAfterSeconds: null });
  assert.deepEqual(requests, [
    "GET https://dev.azure.com/my-org/my%20project/_apis/git/repositories/my-repo/pullrequests?searchCriteria.reviewerId=kestrel&searchCriteria.status=active&$top=200&api-version=7.1",
  ]);
});

test("without a repository, fetches them across the organisation", async () => {
  const { client, requests } = fakeAdo();
  await client.getPullRequestsAssignedTo("kestrel", null);

  assert.deepEqual(requests, [
    "GET https://dev.azure.com/my-org/_apis/git/pullrequests?searchCriteria.reviewerId=kestrel&searchCriteria.status=active&$top=200&api-version=7.1",
  ]);
});
