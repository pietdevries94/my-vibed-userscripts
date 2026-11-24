import type { LinkedWorkItems } from "./linked-work-item.ts";
import assert from "node:assert/strict";
import { groupByWorkItem } from "./work-item-groups.ts";
import { test } from "node:test";

const row = (
  name: string,
  ids: number[],
  title: string | null = null,
): { row: string; linked: LinkedWorkItems } => ({
  linked: { ids, title },
  row: name,
});

const summary = (groups: ReturnType<typeof groupByWorkItem<string>>): [string, string[]][] =>
  groups.map((group) => [group.label, group.rows]);

test("pull requests with the same work item share a group, in the order they first show", () => {
  const groups = groupByWorkItem([
    row("a", [7], "Login"),
    row("b", [3], "Basket"),
    row("c", [7], "Login"),
  ]);
  assert.deepEqual(summary(groups), [
    ["#7", ["a", "c"]],
    ["#3", ["b"]],
  ]);
  assert.deepEqual(
    groups.map(({ key, workItemId, title }) => ({ key, title, workItemId })),
    [
      { key: "7", title: "Login", workItemId: 7 },
      { key: "3", title: "Basket", workItemId: 3 },
    ],
  );
});

test("pull requests with several work items, then those without, come last", () => {
  const groups = groupByWorkItem([row("a", []), row("b", [1, 2]), row("c", [5]), row("d", [3, 4])]);
  assert.deepEqual(summary(groups), [
    ["#5", ["c"]],
    ["Multiple work items", ["b", "d"]],
    ["No work item", ["a"]],
  ]);
  assert.deepEqual(
    groups.map(({ workItemId }) => workItemId),
    [5, null, null],
  );
});

test("no pull requests, no groups", () => {
  assert.deepEqual(groupByWorkItem([]), []);
});
