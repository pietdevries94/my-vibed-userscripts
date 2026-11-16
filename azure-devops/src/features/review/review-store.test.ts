import assert from "node:assert/strict";
import { createTestReviewStore } from "./review-store.test-page.ts";
import { reviewKey } from "./review-store.ts";
import { test } from "node:test";

const KEY = reviewKey("dev.azure.com/quillfield", {
  project: "Ledger Works",
  pullRequestId: 4711,
  repository: "ledger-api",
});
const OTHER_KEY = reviewKey("dev.azure.com/quillfield", {
  project: "Ledger Works",
  pullRequestId: 4712,
  repository: "ledger-api",
});
const ANCHOR = {
  filePath: "/src/totals.ts",
  iteration: 2,
  line: 12,
  lineLength: 30,
  side: "right",
} as const;
const DAY_MS = 86_400_000;
const MAX_AGE_MS = 30 * DAY_MS;

test("a review has one key per pull request", () => {
  assert.equal(KEY, "review:dev.azure.com/quillfield/Ledger Works/ledger-api/4711");
  assert.notEqual(KEY, OTHER_KEY);
});

test("an added comment is pending under its pull request only", () => {
  const { store } = createTestReviewStore();
  const added = store.add(KEY, { anchor: ANCHOR, content: "Why not sum here?" });
  assert.deepEqual(store.pending(KEY), [
    {
      anchor: ANCHOR,
      content: "Why not sum here?",
      id: added.id,
      isAttempted: false,
      postedThreadId: null,
    },
  ]);
  assert.deepEqual(store.pending(OTHER_KEY), []);
});

test("a posted comment is no longer pending, and stays in the review for a retry", () => {
  const { store } = createTestReviewStore();
  const first = store.add(KEY, { anchor: ANCHOR, content: "First" });
  const second = store.add(KEY, { anchor: null, content: "Second" });
  store.change(KEY, first.id, { isAttempted: true, postedThreadId: 9 });
  assert.deepEqual(
    store.pending(KEY).map(({ id }) => id),
    [second.id],
  );
  assert.equal(store.comments(KEY).length, 2);
});

test("the review is deleted with its last pending comment", () => {
  const { store, stored } = createTestReviewStore();
  const first = store.add(KEY, { anchor: ANCHOR, content: "First" });
  const second = store.add(KEY, { anchor: null, content: "Second" });
  store.change(KEY, first.id, { postedThreadId: 9 });
  assert.ok(stored.has(KEY));
  store.remove(KEY, second.id);
  assert.ok(!stored.has(KEY));
});

test("discarding deletes the review", () => {
  const { store, stored } = createTestReviewStore();
  store.add(KEY, { anchor: null, content: "First" });
  store.discard(KEY);
  assert.ok(!stored.has(KEY));
});

test("reviews untouched for 30 days are deleted, newer ones and other values stay", () => {
  const { clock, store, stored } = createTestReviewStore();
  store.add(KEY, { anchor: null, content: "Old" });
  clock.now = 2 * DAY_MS;
  store.add(OTHER_KEY, { anchor: null, content: "Newer" });
  stored.set("starred-reviewers:dev.azure.com/quillfield", []);
  stored.set("review:unreadable", { comments: "none" });
  clock.now = MAX_AGE_MS + DAY_MS;
  store.deleteOlderThan(MAX_AGE_MS);
  assert.deepEqual([...stored.keys()].toSorted(), [
    OTHER_KEY,
    "review:unreadable",
    "starred-reviewers:dev.azure.com/quillfield",
  ]);
});

test("editing a comment counts as a change to the review", () => {
  const { clock, store, stored } = createTestReviewStore();
  const added = store.add(KEY, { anchor: null, content: "Draft" });
  clock.now = MAX_AGE_MS;
  store.change(KEY, added.id, { content: "Better" });
  clock.now = MAX_AGE_MS + DAY_MS;
  store.deleteOlderThan(MAX_AGE_MS);
  assert.equal(store.pending(KEY)[0]?.content, "Better");
  assert.ok(stored.has(KEY));
});
