import type { AssignedPullRequest } from "./assigned-tabs.ts";
import assert from "node:assert/strict";
import { pullRequestsOnTab } from "./assigned-tabs.ts";
import { test } from "node:test";

const ME = "kestrel";

function assigned(pullRequestId: number, vote: number, creationDate: string): AssignedPullRequest {
  return {
    creationDate,
    pullRequestId,
    reviewers: [
      { id: "heron", vote: 10 },
      { id: ME, vote },
    ],
  };
}

const PULL_REQUESTS = [
  assigned(1, 0, "2026-01-01T00:00:00Z"),
  assigned(2, -5, "2026-01-02T00:00:00Z"),
  assigned(3, 10, "2026-01-03T00:00:00Z"),
  assigned(4, 5, "2026-01-04T00:00:00Z"),
  assigned(5, -10, "2026-01-05T00:00:00Z"),
  assigned(6, 0, "2026-01-06T00:00:00Z"),
];

const idsOnTab = (tabId: string): number[] =>
  pullRequestsOnTab(PULL_REQUESTS, ME, tabId).map(({ pullRequestId }) => pullRequestId);

test("Active holds the pull requests I have not voted on, newest first", () => {
  assert.deepEqual(idsOnTab("__bolt-tab-activeMine"), [6, 1]);
});

test("Waiting for author holds the pull requests I voted to wait on", () => {
  assert.deepEqual(idsOnTab("__bolt-tab-waitingForAuthor"), [2]);
});

test("any other tab, Reviewed, holds the pull requests I approved or rejected", () => {
  assert.deepEqual(idsOnTab("__bolt-tab-reviewed"), [5, 4, 3]);
});

test("a pull request without me as a reviewer is on no tab", () => {
  const others = [{ pullRequestId: 7, reviewers: [{ id: "heron", vote: 0 }] }];
  assert.deepEqual(pullRequestsOnTab(others, ME, "__bolt-tab-activeMine"), []);
});
