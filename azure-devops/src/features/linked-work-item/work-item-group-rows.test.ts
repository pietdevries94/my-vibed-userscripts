import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showGroupsLoading } from "./work-item-group-rows.ts";
import { test } from "node:test";

function createList(): HTMLElement {
  const { document } = new JSDOM(
    `<!doctype html><table class="repos-pr-list"><tbody></tbody></table>`,
  ).window;
  const list = document.querySelector("tbody");
  assert.ok(list);
  return list;
}

test("marks the list's table as busy while its groups are on their way, and unmarks it after", () => {
  const list = createList();
  const table = list.closest("table");
  showGroupsLoading(list, true);
  assert.equal(table?.dataset.fixAdoGroupsLoading, "");
  assert.equal(table?.getAttribute("aria-busy"), "true");
  showGroupsLoading(list, false);
  assert.equal(table?.dataset.fixAdoGroupsLoading, undefined);
  assert.equal(table?.hasAttribute("aria-busy"), false);
});
