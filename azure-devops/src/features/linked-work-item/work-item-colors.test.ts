import { showWorkItemColors, workItemHues } from "./work-item-group-rows.ts";
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
const hueOf = (element: HTMLElement | undefined): string | undefined =>
  element?.dataset.fixAdoWorkItemHue;

test("spreads the hues of a page's work items evenly around the circle, away from Azure DevOps's blue at 250", () => {
  assert.deepEqual(
    [...workItemHues([78, 77, 79])],
    [
      [77, 340],
      [78, 70],
      [79, 160],
    ],
  );
  assert.deepEqual([...workItemHues([79, 78, 77])], [...workItemHues([77, 78, 79])]);
});

test("colours the rows that share their work item with another row, also when not grouped", () => {
  const { list, rows } = createList();
  const [first, second, third] = rows;
  assert.ok(first !== undefined && second !== undefined && third !== undefined);
  showWorkItemColors([
    {
      isGrouped: false,
      list,
      rows: [
        { linked: linked(77), row: first },
        { linked: linked(77), row: second },
        { linked: linked(78), row: third },
      ],
    },
  ]);
  assert.equal(hueOf(first), "70");
  assert.equal(hueOf(second), "70");
  assert.equal(hueOf(third), undefined);
  assert.equal(first.style.getPropertyValue("--fix-ado-work-item-hue"), "70");
});

test("colours every row of a work item's group, and its group row, when grouped", () => {
  const { band, list, rows } = createList();
  const [first, second, third] = rows;
  assert.ok(first !== undefined && second !== undefined && third !== undefined);
  showWorkItemColors([
    {
      isGrouped: true,
      list,
      rows: [
        { linked: linked(77), row: first },
        { linked: linked(78), row: second },
        { linked: linked(78, 79), row: third },
      ],
    },
  ]);
  assert.equal(hueOf(band), "10");
  assert.equal(hueOf(first), "10");
  assert.equal(hueOf(second), "130");
  // Several work items share no single colour.
  assert.equal(hueOf(third), undefined);
});

test("gives a work item the same colour in every list of the page", () => {
  const first = createList();
  const second = createList();
  const [onlyRow] = first.rows;
  const [otherRow, sameRow] = second.rows;
  assert.ok(onlyRow !== undefined && otherRow !== undefined && sameRow !== undefined);
  showWorkItemColors([
    { isGrouped: true, list: first.list, rows: [{ linked: linked(77), row: onlyRow }] },
    {
      isGrouped: true,
      list: second.list,
      rows: [
        { linked: linked(78), row: otherRow },
        { linked: linked(77), row: sameRow },
      ],
    },
  ]);
  assert.equal(hueOf(onlyRow), hueOf(sameRow));
  assert.notEqual(hueOf(otherRow), hueOf(sameRow));
});

test("takes the colour away from a row that no longer shares its work item", () => {
  const { list, rows } = createList();
  const [first, second] = rows;
  assert.ok(first !== undefined && second !== undefined);
  const show = (secondLinked: LinkedWorkItems | null): void => {
    showWorkItemColors([
      {
        isGrouped: false,
        list,
        rows: [
          { linked: linked(77), row: first },
          { linked: secondLinked, row: second },
        ],
      },
    ]);
  };
  show(linked(77));
  show(null);
  assert.equal(hueOf(first), undefined);
  assert.equal(first.style.getPropertyValue("--fix-ado-work-item-hue"), "");
});
