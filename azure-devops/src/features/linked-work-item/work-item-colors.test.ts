import { showWorkItemColors, workItemHue } from "./work-item-group-rows.ts";
import { JSDOM } from "jsdom";
import type { LinkedWorkItems } from "./linked-work-item.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

/** A list with a group row for work item 77 and three pull request rows. */
function createList(): { list: HTMLElement; rows: HTMLElement[]; band: HTMLElement } {
  const { document } = new JSDOM(`<!doctype html><table><tbody>
    <tr class="fix-ado-work-item-group" data-fix-ado-work-item-group="77"><td></td></tr>
    <tr class="row"></tr><tr class="row"></tr><tr class="row"></tr></tbody></table>`).window;
  const list = document.querySelector<HTMLElement>("tbody");
  const band = document.querySelector<HTMLElement>(".fix-ado-work-item-group");
  assert.ok(list !== null && band !== null);
  return { band, list, rows: [...document.querySelectorAll<HTMLElement>(".row")] };
}

const linked = (...ids: number[]): LinkedWorkItems => ({ ids, title: null });
const hueOf = (element: HTMLElement): string | undefined => element.dataset.fixAdoWorkItemHue;

test("gives each work item its own hue, always the same, and far apart for ids next to each other", () => {
  assert.equal(workItemHue(77), workItemHue(77));
  const apart = Math.abs(workItemHue(77) - workItemHue(78));
  assert.ok(Math.min(apart, 360 - apart) > 90);
});

test("colours the rows that share their work item with another row, also when not grouped", () => {
  const { list, rows } = createList();
  const [first, second, third] = rows;
  assert.ok(first !== undefined && second !== undefined && third !== undefined);
  showWorkItemColors(
    list,
    [
      { linked: linked(77), row: first },
      { linked: linked(77), row: second },
      { linked: linked(78), row: third },
    ],
    false,
  );
  assert.equal(hueOf(first), String(workItemHue(77)));
  assert.equal(hueOf(second), String(workItemHue(77)));
  assert.equal(hueOf(third), undefined);
  assert.equal(first.style.getPropertyValue("--fix-ado-work-item-hue"), String(workItemHue(77)));
});

test("colours every row of a work item's group, and its group row, when grouped", () => {
  const { band, list, rows } = createList();
  const [first, second, third] = rows;
  assert.ok(first !== undefined && second !== undefined && third !== undefined);
  showWorkItemColors(
    list,
    [
      { linked: linked(77), row: first },
      { linked: linked(78), row: second },
      { linked: linked(78, 79), row: third },
    ],
    true,
  );
  assert.equal(hueOf(band), String(workItemHue(77)));
  assert.equal(hueOf(first), String(workItemHue(77)));
  assert.equal(hueOf(second), String(workItemHue(78)));
  // Several work items share no single colour.
  assert.equal(hueOf(third), undefined);
});

test("takes the colour away from a row that no longer shares its work item", () => {
  const { list, rows } = createList();
  const [first, second] = rows;
  assert.ok(first !== undefined && second !== undefined);
  showWorkItemColors(
    list,
    [
      { linked: linked(77), row: first },
      { linked: linked(77), row: second },
    ],
    false,
  );
  showWorkItemColors(
    list,
    [
      { linked: linked(77), row: first },
      { linked: null, row: second },
    ],
    false,
  );
  assert.equal(hueOf(first), undefined);
  assert.equal(first.style.getPropertyValue("--fix-ado-work-item-hue"), "");
});
