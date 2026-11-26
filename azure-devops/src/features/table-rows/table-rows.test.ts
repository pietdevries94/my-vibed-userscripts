import { isWindows98Mode, showTableRows } from "./table-rows.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

/** The test reads the records with takeRecords instead. */
const ignoreRecords = (): void => undefined;

/** A row's cells in Azure DevOps's markup, with invented values. */
const CELLS = `<td class="bolt-table-cell-compact"></td>
  <td aria-colindex="1"><div class="bolt-table-cell-content"><div><div class="bolt-coin" aria-label="Doe, Jane"></div></div></div></td>
  <td aria-colindex="2" class="bolt-table-two-line-cell"><div class="bolt-table-cell-content">
    <div class="bolt-table-two-line-cell-item"><div class="body-l">Fix the thing</div></div>
    <div class="bolt-table-two-line-cell-item"><div class="secondary-text"><span>Doe, Jane request !4021 into
      <span class="padding-horizontal-4">Webshop</span><span class="monospaced-xs padding-horizontal-4">main</span></span><span class="fix-ado-linked-work-item">#77</span></div></div>
  </div></td>`;

/** A list with one pull request row. Azure DevOps puts an <a> row in the table with DOM calls,
 *  which an HTML parser would move out of the table, so the row is built the same way. */
function createList(): JSDOM {
  const dom = new JSDOM(
    `<!doctype html><body><table class="repos-pr-list"><colgroup><col><col></colgroup><tbody></tbody></table></body>`,
  );
  const { document } = dom.window;
  const cells = document.createElement("tbody");
  cells.innerHTML = `<tr>${CELLS}</tr>`;
  const row = document.createElement("a");
  row.className = "bolt-table-row";
  row.setAttribute("role", "row");
  row.setAttribute("href", "/org/proj/_git/repo/pullrequest/4021");
  row.append(...(cells.querySelector("tr")?.children ?? []));
  document.querySelector("tbody")?.replaceChildren(row);
  return dom;
}

function rowOf(document: Document): Element {
  const row = document.querySelector("a.bolt-table-row");
  assert.ok(row);
  return row;
}

/** True when the row's work item cell shows a work item id, in the link colour. */
function isIdCell(row: Element): boolean {
  const cell = row.querySelector<HTMLElement>(":scope > td.fix-ado-table-work-item");
  assert.ok(cell);
  return Object.hasOwn(cell.dataset, "fixAdoIsId");
}

test("marks the page while the lists show as a table, and unmarks it after", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  assert.equal(Object.hasOwn(document.documentElement.dataset, "fixAdoTable"), true);
  showTableRows(document, false);
  assert.equal(Object.hasOwn(document.documentElement.dataset, "fixAdoTable"), false);
});

test("puts a header with the column names above each list", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  const heads = [...document.querySelectorAll("table > thead.fix-ado-table-head th")];
  assert.deepEqual(
    heads.map((head) => head.textContent),
    ["", "Pull request", "Author", "Id", "Target", "Work item", "Reviewers", "Comments", "Age"],
  );
  assert.equal(document.querySelector("table > thead + tbody") !== null, true);
});

test("gives each pull request the author's name, its id, its target and its work item", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  const row = rowOf(document);
  assert.equal(
    row.querySelector('[aria-colindex="1"] .fix-ado-table-author')?.textContent,
    "Doe, Jane",
  );
  assert.equal(row.querySelector(":scope > td.fix-ado-table-id")?.textContent, "!4021");
  const target = row.querySelector(":scope > td.fix-ado-table-target");
  assert.equal(target?.textContent, "Webshop → main");
  assert.equal(target?.querySelector(".fix-ado-table-branch")?.textContent, "main");
  const workItem = row.querySelector(":scope > td.fix-ado-table-work-item");
  assert.equal(workItem?.textContent, "#77");
  assert.equal(isIdCell(row), true);
});

test("marks a work item cell without an id, such as Multiple work items, as plain text", () => {
  const { document } = createList().window;
  const label = document.querySelector(".fix-ado-linked-work-item");
  assert.ok(label);
  label.textContent = "Multiple work items";
  showTableRows(document, true);
  assert.equal(isIdCell(rowOf(document)), false);
});

test("follows a row Azure DevOps reuses for another pull request", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  const row = rowOf(document);
  row.setAttribute("href", "/org/proj/_git/repo/pullrequest/4022");
  const branch = row.querySelector(".monospaced-xs");
  assert.ok(branch);
  branch.textContent = "release";
  showTableRows(document, true);
  assert.equal(row.querySelectorAll(".fix-ado-table-id").length, 1);
  assert.equal(row.querySelector(".fix-ado-table-id")?.textContent, "!4022");
  assert.equal(row.querySelector(".fix-ado-table-target")?.textContent, "Webshop → release");
});

test("shows the branch alone where Azure DevOps names no repository, as on a repository's own list", () => {
  const { document } = createList().window;
  document.querySelector(".padding-horizontal-4:not(.monospaced-xs)")?.remove();
  showTableRows(document, true);
  const target = rowOf(document).querySelector(".fix-ado-table-target");
  assert.equal(target?.textContent, "main");
  assert.equal(target?.firstElementChild?.className, "fix-ado-table-branch");
});

test("takes everything away when turned off, and puts the work item back under the title", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  showTableRows(document, false);
  assert.equal(document.querySelector('[class*="fix-ado-table"]'), null);
  assert.equal(
    document.querySelector(".secondary-text > .fix-ado-linked-work-item")?.textContent,
    "#77",
  );
});

test("writes nothing when the page already shows the table", () => {
  const { window } = createList();
  showTableRows(window.document, true);
  const observer = new window.MutationObserver(ignoreRecords);
  observer.observe(window.document.documentElement, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  showTableRows(window.document, true);
  assert.deepEqual(observer.takeRecords(), []);
});

test("Windows 98 mode is on while it marks the page, also with an empty mark", () => {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  assert.equal(isWindows98Mode(document), false);
  document.documentElement.dataset.fixAdoWin98 = "";
  assert.equal(isWindows98Mode(document), true);
});
