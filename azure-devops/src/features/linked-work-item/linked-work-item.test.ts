import assert from "node:assert/strict";
import { linkedWorkItemText } from "./linked-work-item.ts";
import { test } from "node:test";

test("a pull request without a linked work item shows nothing", () => {
  assert.equal(linkedWorkItemText({ ids: [], title: null }), null);
});

test("one linked work item shows its id and title", () => {
  assert.equal(
    linkedWorkItemText({ ids: [123], title: "Fix the login form" }),
    "#123 Fix the login form",
  );
});

test("one linked work item without a readable title shows its id", () => {
  assert.equal(linkedWorkItemText({ ids: [123], title: null }), "#123");
});

test("more than one linked work item shows Multiple work items", () => {
  assert.equal(linkedWorkItemText({ ids: [123, 456], title: null }), "Multiple work items");
});
