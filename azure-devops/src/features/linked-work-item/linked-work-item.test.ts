import assert from "node:assert/strict";
import { linkedWorkItemLabel } from "./linked-work-item.ts";
import { test } from "node:test";

test("a pull request without a linked work item shows nothing", () => {
  assert.equal(linkedWorkItemLabel({ ids: [], title: null }), null);
});

test("one linked work item shows its id, with its title on hover", () => {
  assert.deepEqual(linkedWorkItemLabel({ ids: [123], title: "Fix the login form" }), {
    text: "#123",
    tooltip: "Fix the login form",
  });
});

test("one linked work item without a readable title has no hover", () => {
  assert.deepEqual(linkedWorkItemLabel({ ids: [123], title: null }), {
    text: "#123",
    tooltip: null,
  });
});

test("more than one linked work item shows Multiple work items, with their ids on hover", () => {
  assert.deepEqual(linkedWorkItemLabel({ ids: [123, 456], title: null }), {
    text: "Multiple work items",
    tooltip: "#123, #456",
  });
});
