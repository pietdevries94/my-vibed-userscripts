import assert from "node:assert/strict";
import { relativeTime } from "./relative-time.ts";
import { test } from "node:test";

const NOW = Date.parse("2026-03-10T12:00:00Z");
const ago = (seconds: number): number => NOW - seconds * 1000;

test("says how long ago a pull request was created, in its largest unit", () => {
  assert.equal(relativeTime(ago(20), NOW, "en"), "now");
  assert.equal(relativeTime(ago(5 * 60), NOW, "en"), "5 minutes ago");
  assert.equal(relativeTime(ago(3 * 3600), NOW, "en"), "3 hours ago");
  assert.equal(relativeTime(ago(30 * 3600), NOW, "en"), "yesterday");
  assert.equal(relativeTime(ago(15 * 86_400), NOW, "en"), "2 weeks ago");
  assert.equal(relativeTime(ago(400 * 86_400), NOW, "en"), "last year");
});
