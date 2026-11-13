import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createDaysInColumnToggles } from "./days-in-column-toggle.ts";
import { test } from "node:test";

function board(): Document {
  const { document } = new JSDOM(`
    <div class="kanban-board-column-header-container">
      <span class="kanban-board-column-header"><span class="justify-space-between"><div class="flex-row"><span>New</span></div></span></span>
      <span class="kanban-board-column-header"><span class="justify-space-between"><div class="flex-row"><span>Active</span></div><span>3</span></span></span>
    </div>
    <div class="kanban-board-content">
      <div class="kanban-board-column" data-column="col-a"></div>
      <div class="kanban-board-column" data-column="col-b"></div>
    </div>`).window;
  return document;
}

interface Stored {
  value: string[];
}

function toggles(document: Document, stored: Stored): { sync: () => void } {
  return createDaysInColumnToggles({
    document,
    storage: {
      load: () => stored.value,
      save: (columnIds) => {
        stored.value = columnIds;
      },
    },
  });
}

const buttons = (document: Document): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>(
    ".kanban-board-column-header .fix-ado-days-toggle",
  ),
];
const hiddenColumns = (document: Document): string[] =>
  [...document.querySelectorAll<HTMLElement>("[data-fix-ado-days-hidden]")].map(
    (column) => column.dataset.column ?? "",
  );

test("puts one toggle in each column header, after the column name", () => {
  const document = board();
  const daysToggles = toggles(document, { value: [] });
  daysToggles.sync();
  daysToggles.sync();
  assert.equal(buttons(document).length, 2);
  const [first] = buttons(document);
  assert.equal(first?.previousElementSibling?.textContent, "New");
  assert.equal(first?.getAttribute("aria-pressed"), "true");
  assert.equal(first?.title, "Hide days in column");
});

test("a toggle hides the bars of its column and remembers it", () => {
  const document = board();
  const stored = { value: [] };
  toggles(document, stored).sync();

  buttons(document)[1]?.click();
  assert.deepEqual(hiddenColumns(document), ["col-b"]);
  assert.deepEqual(stored.value, ["col-b"]);
  assert.equal(buttons(document)[1]?.getAttribute("aria-pressed"), "false");
  assert.equal(buttons(document)[1]?.title, "Show days in column");

  buttons(document)[1]?.click();
  assert.deepEqual(hiddenColumns(document), []);
  assert.deepEqual(stored.value, []);
});

test("a column hidden earlier starts hidden", () => {
  const document = board();
  toggles(document, { value: ["col-a"] }).sync();
  assert.deepEqual(hiddenColumns(document), ["col-a"]);
  assert.equal(buttons(document)[0]?.getAttribute("aria-pressed"), "false");
});

test("a click on the toggle does not reach the header", () => {
  const document = board();
  toggles(document, { value: [] }).sync();
  let headerClicks = 0;
  document.querySelector(".kanban-board-column-header")?.addEventListener("click", () => {
    headerClicks += 1;
  });
  buttons(document)[0]?.click();
  assert.equal(headerClicks, 0);
});

test("adds no toggles when headers and columns do not line up", () => {
  const document = board();
  document.querySelector('[data-column="col-b"]')?.remove();
  toggles(document, { value: [] }).sync();
  assert.equal(buttons(document).length, 0);
});
