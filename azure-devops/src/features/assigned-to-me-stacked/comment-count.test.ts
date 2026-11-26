import { countComments, createCommentCount } from "./comment-count.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

const text = { commentType: "text" };
const system = { commentType: "system" };

test("counts the threads with a comment, and the active ones among them", () => {
  const count = countComments([
    { comments: [text], id: 1, status: "active" },
    { comments: [text], id: 2, status: "pending" },
    { comments: [text], id: 3, status: "fixed" },
    { comments: [text], id: 4, isDeleted: true, status: "active" },
    { comments: [system], id: 5, properties: { CodeReviewThreadType: { $value: "VoteUpdate" } } },
  ]);

  assert.deepEqual(count, { active: 2, total: 3 });
});

const { document } = new JSDOM("<!doctype html><body></body>").window;

test("shows active of total, with the site's warning icon, while threads are active", () => {
  const shown = createCommentCount(document, { active: 2, total: 5 });

  assert.equal(shown?.textContent, "2/5");
  assert.ok(shown?.querySelector(".ms-Icon--ChatWarning"));
  assert.ok(shown?.querySelector(".repos-pr-list-comment-count.has-active-comments"));
});

test("shows only the total, with the site's feed icon, without active threads", () => {
  const shown = createCommentCount(document, { active: 0, total: 3 });

  assert.equal(shown?.textContent, "3");
  assert.ok(shown?.querySelector(".ms-Icon--ActivityFeed"));
  assert.ok(shown?.classList.contains("secondary-text"));
});

test("shows nothing without comments", () => {
  assert.equal(createCommentCount(document, { active: 0, total: 0 }), null);
});
