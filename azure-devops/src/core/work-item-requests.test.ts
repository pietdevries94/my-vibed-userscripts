import type { WorkItemRequests } from "./work-item-requests.ts";
import assert from "node:assert/strict";
import { createWorkItemRequests } from "./work-item-requests.ts";
import { test } from "node:test";

const PULL_REQUEST = { project: "my project", pullRequestId: 42, repository: "my-repo" };

function fakeAdo(body: unknown): { requests: string[]; client: WorkItemRequests } {
  const requests: string[] = [];
  const client = createWorkItemRequests({
    apiBasePath: "/my-org",
    fetch: async (url, init) => {
      requests.push(`${init.method} ${url}`);
      return Response.json(body);
    },
    origin: "https://dev.azure.com",
  });
  return { client, requests };
}

test("fetches the ids of the work items linked to a pull request", async () => {
  const { client, requests } = fakeAdo({
    value: [
      { id: "123", url: "x" },
      { id: "456", url: "y" },
    ],
  });
  assert.deepEqual(await client.getPullRequestWorkItemIds(PULL_REQUEST), [123, 456]);
  assert.deepEqual(requests, [
    "GET https://dev.azure.com/my-org/my%20project/_apis/git/repositories/my-repo/pullRequests/42/workitems?api-version=7.1",
  ]);
});

test("fetches the title of a work item", async () => {
  const { client, requests } = fakeAdo({
    value: [{ fields: { "System.Title": "Fix the login form" }, id: 123 }],
  });
  assert.equal(await client.getWorkItemTitle(123), "Fix the login form");
  assert.deepEqual(requests, [
    "GET https://dev.azure.com/my-org/_apis/wit/workitems?ids=123&fields=System.Title&errorPolicy=Omit&api-version=7.1",
  ]);
});

test("a deleted or unreadable work item has no title", async () => {
  const { client } = fakeAdo({ value: [null] });
  assert.equal(await client.getWorkItemTitle(123), null);
});
