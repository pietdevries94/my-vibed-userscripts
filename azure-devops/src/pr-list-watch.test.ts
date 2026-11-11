import type { PullRequestListPage } from "./pull-request-link.ts";
import type { PullRequestsResponse } from "./ado-client.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { watchPullRequestList } from "./pr-list-watch.ts";

const ACTIVE_LIST: PullRequestListPage = {
  project: "project",
  repository: "repo",
  status: "active",
};

test("each list and tab is its own page", () => {
  const client = {
    getPullRequests: async (): Promise<PullRequestsResponse> => ({
      pullRequests: [],
      retryAfterSeconds: null,
    }),
  };
  const active = watchPullRequestList(client, ACTIVE_LIST, () => []);
  const completed = watchPullRequestList(client, { ...ACTIVE_LIST, status: "completed" }, () => []);
  assert.notEqual(active.key, completed.key);
  assert.equal(active.key, watchPullRequestList(client, { ...ACTIVE_LIST }, () => []).key);
});

test("compares the fetched list with the pull requests on screen", async () => {
  let title = "Title";
  const requestedLists: PullRequestListPage[] = [];
  const client = {
    async getPullRequests(listPage: PullRequestListPage): Promise<PullRequestsResponse> {
      requestedLists.push(listPage);
      return {
        pullRequests: [
          { pullRequestId: 1, title },
          { pullRequestId: 2, title: "Other" },
        ],
        retryAfterSeconds: 7,
      };
    },
  };
  let onScreenIds = [2];
  const page = watchPullRequestList(client, ACTIVE_LIST, () => onScreenIds);

  const loaded = await page.fetchSnapshot();
  assert.equal(loaded.retryAfterSeconds, 7);
  assert.deepEqual(requestedLists, [ACTIVE_LIST]);

  title = "New title";
  const current = await page.fetchSnapshot();
  assert.equal(
    page.hasChanged(loaded.snapshot, current.snapshot),
    false,
    "pull request 1 is not on screen",
  );
  onScreenIds = [1, 2];
  assert.equal(page.hasChanged(loaded.snapshot, current.snapshot), true);
});
