import { hasListChanged, snapshotOf } from "./pr-list-changes.ts";
import type { ListedPullRequest } from "./pr-list-changes.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const pullRequest = (
  pullRequestId: number,
  changes: Partial<ListedPullRequest> = {},
): ListedPullRequest => ({
  isDraft: false,
  lastMergeSourceCommit: { commitId: "abc" },
  pullRequestId,
  reviewers: [
    { id: "kestrel", vote: 0 },
    { id: "bob", vote: 10 },
  ],
  status: "active",
  targetRefName: "refs/heads/main",
  title: "Title",
  ...changes,
});

const changed = (
  before: ListedPullRequest[],
  after: ListedPullRequest[],
  onScreen: number[],
): boolean => hasListChanged(snapshotOf(before), snapshotOf(after), onScreen);

test("the same list has not changed", () => {
  assert.equal(
    changed([pullRequest(1), pullRequest(2)], [pullRequest(2), pullRequest(1)], [1, 2]),
    false,
  );
});

test("reviewer order does not matter", () => {
  const reversed = pullRequest(1, {
    reviewers: [
      { id: "bob", vote: 10 },
      { id: "kestrel", vote: 0 },
    ],
  });
  assert.equal(changed([pullRequest(1)], [reversed], [1]), false);
});

test("an added or removed pull request is a change, also off screen", () => {
  assert.equal(changed([pullRequest(1)], [pullRequest(1), pullRequest(2)], [1]), true);
  assert.equal(changed([pullRequest(1), pullRequest(2)], [pullRequest(1)], [1]), true);
  assert.equal(
    changed([pullRequest(1), pullRequest(2)], [pullRequest(1), pullRequest(3)], [1]),
    true,
  );
});

for (const [what, changes] of Object.entries({
  "auto-complete": { autoCompleteSetBy: { id: "kestrel" } },
  "draft state": { isDraft: true },
  "pushed commit": { lastMergeSourceCommit: { commitId: "def" } },
  reviewers: { reviewers: [{ id: "kestrel", vote: 0 }] },
  "target branch": { targetRefName: "refs/heads/release" },
  title: { title: "New title" },
  vote: {
    reviewers: [
      { id: "kestrel", vote: -5 },
      { id: "bob", vote: 10 },
    ],
  },
} satisfies Record<string, Partial<ListedPullRequest>>)) {
  test(`a changed ${what} of a pull request on screen is a change`, () => {
    assert.equal(changed([pullRequest(1)], [pullRequest(1, changes)], [1]), true);
  });
}

test("a change to a pull request that is not on screen is ignored", () => {
  assert.equal(
    changed(
      [pullRequest(1), pullRequest(2)],
      [pullRequest(1), pullRequest(2, { title: "New title" })],
      [1],
    ),
    false,
  );
});

test("a pull request on screen that the list never contained is ignored", () => {
  assert.equal(changed([pullRequest(1)], [pullRequest(1)], [1, 99]), false);
});

test("a reviewer that became required is a change", () => {
  const nowRequired = pullRequest(1, {
    reviewers: [
      { id: "kestrel", isRequired: true, vote: 0 },
      { id: "bob", vote: 10 },
    ],
  });
  assert.equal(changed([pullRequest(1)], [nowRequired], [1]), true);
});
