import assert from "node:assert/strict";
import { test } from "node:test";
import { hasListChanged, snapshotOf, type ListedPullRequest } from "./pr-list-changes.ts";

const pullRequest = (pullRequestId: number, changes: Partial<ListedPullRequest> = {}): ListedPullRequest => ({
  pullRequestId,
  title: "Title",
  isDraft: false,
  status: "active",
  targetRefName: "refs/heads/main",
  reviewers: [{ id: "kestrel", vote: 0 }, { id: "bob", vote: 10 }],
  lastMergeSourceCommit: { commitId: "abc" },
  ...changes,
});

const changed = (before: ListedPullRequest[], after: ListedPullRequest[], onScreen: number[]) =>
  hasListChanged(snapshotOf(before), snapshotOf(after), onScreen);

test("the same list has not changed", () => {
  assert.equal(changed([pullRequest(1), pullRequest(2)], [pullRequest(2), pullRequest(1)], [1, 2]), false);
});

test("reviewer order does not matter", () => {
  const reversed = pullRequest(1, { reviewers: [{ id: "bob", vote: 10 }, { id: "kestrel", vote: 0 }] });
  assert.equal(changed([pullRequest(1)], [reversed], [1]), false);
});

test("an added or removed pull request is a change, also off screen", () => {
  assert.equal(changed([pullRequest(1)], [pullRequest(1), pullRequest(2)], [1]), true);
  assert.equal(changed([pullRequest(1), pullRequest(2)], [pullRequest(1)], [1]), true);
  assert.equal(changed([pullRequest(1), pullRequest(2)], [pullRequest(1), pullRequest(3)], [1]), true);
});

for (const [what, changes] of Object.entries({
  "title": { title: "New title" },
  "draft state": { isDraft: true },
  "target branch": { targetRefName: "refs/heads/release" },
  "pushed commit": { lastMergeSourceCommit: { commitId: "def" } },
  "vote": { reviewers: [{ id: "kestrel", vote: -5 }, { id: "bob", vote: 10 }] },
  "reviewers": { reviewers: [{ id: "kestrel", vote: 0 }] },
  "auto-complete": { autoCompleteSetBy: { id: "kestrel" } },
} satisfies Record<string, Partial<ListedPullRequest>>)) {
  test(`a changed ${what} of a pull request on screen is a change`, () => {
    assert.equal(changed([pullRequest(1)], [pullRequest(1, changes)], [1]), true);
  });
}

test("a change to a pull request that is not on screen is ignored", () => {
  assert.equal(changed([pullRequest(1), pullRequest(2)], [pullRequest(1), pullRequest(2, { title: "New title" })], [1]), false);
});

test("a pull request on screen that the list never contained is ignored", () => {
  assert.equal(changed([pullRequest(1)], [pullRequest(1)], [1, 99]), false);
});

test("a reviewer that became required is a change", () => {
  const nowRequired = pullRequest(1, { reviewers: [{ id: "kestrel", vote: 0, isRequired: true }, { id: "bob", vote: 10 }] });
  assert.equal(changed([pullRequest(1)], [nowRequired], [1]), true);
});
