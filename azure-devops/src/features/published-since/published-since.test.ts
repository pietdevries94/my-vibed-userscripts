import {
  isPublishedTooLongAgo,
  publishedAt,
  publishedSinceText,
  showsPublishedSince,
} from "./published-since.ts";
import type { Page } from "../../core/page.ts";
import type { PullRequestThread } from "../../pull-requests/review-requests.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const CREATED = "2030-03-01T09:00:00.000Z";

function draftUpdate(id: number, date: string, isDeleted = false): PullRequestThread {
  return {
    id,
    isDeleted,
    properties: { CodeReviewThreadType: { $value: "IsDraftUpdate" } },
    publishedDate: date,
  };
}

const comment: PullRequestThread = { id: 7, publishedDate: "2030-03-05T09:00:00.000Z" };

test("a pull request never marked as draft was published when it was created", () => {
  assert.equal(publishedAt(CREATED, [comment]), Date.parse(CREATED));
});

test("a pull request that left draft was published at its last draft change", () => {
  const threads = [
    draftUpdate(2, "2030-03-02T09:00:00.000Z"),
    draftUpdate(4, "2030-03-04T09:00:00.000Z"),
    draftUpdate(3, "2030-03-03T09:00:00.000Z"),
    comment,
  ];
  assert.equal(publishedAt(CREATED, threads), Date.parse("2030-03-04T09:00:00.000Z"));
});

test("a deleted draft change does not count", () => {
  const threads = [
    draftUpdate(2, "2030-03-02T09:00:00.000Z"),
    draftUpdate(4, "2030-03-04T09:00:00.000Z", true),
  ];
  assert.equal(publishedAt(CREATED, threads), Date.parse("2030-03-02T09:00:00.000Z"));
});

test("the text names the largest whole unit", () => {
  const cases: [number, string][] = [
    [20_000, "Published just now"],
    [MINUTE, "Published 1 minute ago"],
    [3 * MINUTE + 59_000, "Published 3 minutes ago"],
    [HOUR, "Published 1 hour ago"],
    [23 * HOUR, "Published 23 hours ago"],
    [DAY, "Published 1 day ago"],
    [29 * DAY, "Published 29 days ago"],
    [30 * DAY, "Published 1 month ago"],
    [400 * DAY, "Published 1 year ago"],
  ];
  for (const [elapsed, text] of cases) {
    assert.equal(publishedSinceText(1_000_000_000_000, 1_000_000_000_000 + elapsed), text);
  }
});

test("a publish time a little ahead of the local clock reads as just now", () => {
  assert.equal(publishedSinceText(5000, 0), "Published just now");
});

/** Local time on a day in March 2030. The 1st is a Friday. */
const march = (day: number, hour: number, minute = 0): number =>
  new Date(2030, 2, day, hour, minute).getTime();

test("a weekend does not count towards the wait", () => {
  assert.equal(isPublishedTooLongAgo(march(1, 9), march(5, 8, 59)), false);
  assert.equal(isPublishedTooLongAgo(march(1, 9), march(5, 9, 1)), true);
});

test("a wait of more than two weekdays is too long", () => {
  assert.equal(isPublishedTooLongAgo(march(4, 9), march(6, 9)), false);
  assert.equal(isPublishedTooLongAgo(march(4, 9), march(6, 9, 1)), true);
});

test("a pull request published on a Saturday waits from Monday", () => {
  assert.equal(isPublishedTooLongAgo(march(2, 10), march(5, 23)), false);
  assert.equal(isPublishedTooLongAgo(march(2, 10), march(7, 0, 1)), true);
});

const list = (status: "active" | "completed" | "abandoned"): Page => ({
  kind: "pull-request-list",
  listPage: { project: "Shop", repository: "web", status },
});

test("only lists of active pull requests show publish times", () => {
  assert.equal(showsPublishedSince(list("active")), true);
  assert.equal(showsPublishedSince(list("completed")), false);
  assert.equal(showsPublishedSince(list("abandoned")), false);
  assert.equal(showsPublishedSince({ kind: "pull-request-inbox" }), true);
  assert.equal(showsPublishedSince({ kind: "board" }), false);
});
