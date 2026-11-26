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
  </div></td>
  <td aria-colindex="5"><div class="bolt-table-cell-content"><div>Updated <span class="text-ellipsis"><time class="bolt-time-item" datetime="2026-01-10T12:00:00.000Z">3 days ago</time></span></div></div></td>`;

/** Three days and a bit after the row's update time. */
const NOW = Date.parse("2026-01-13T13:00:00.000Z");

/** A section card with this title and a list with one pull request row. Azure DevOps puts an <a>
 *  row in the table with DOM calls, which an HTML parser would move out of the table, so the row is
 *  built the same way. */
function createList(cardTitle = "Assigned to me"): JSDOM {
  const dom = new JSDOM(
    `<!doctype html><body><div class="repos-pr-section-card">
      <div class="repos-pr-section-header-title"><span class="text-ellipsis">${cardTitle}</span></div>
      <table class="repos-pr-list"><colgroup><col><col></colgroup><tbody></tbody></table>
    </div></body>`,
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

/** True when the table shows the list of a card with this title as the Created by me list. */
function isMarkedCreatedByMe(cardTitle: string): boolean {
  const { document } = createList(cardTitle).window;
  showTableRows(document, true);
  const list = document.querySelector<HTMLElement>("table");
  return list !== null && Object.hasOwn(list.dataset, "fixAdoCreatedByMe");
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

test("gives each pull request the author's name as a tooltip, its id, its target and its work item", () => {
  const { document } = createList().window;
  showTableRows(document, true);
  const row = rowOf(document);
  assert.equal(row.querySelector('[aria-colindex="1"]')?.getAttribute("title"), "Doe, Jane");
  assert.equal(row.querySelector(":scope > td.fix-ado-table-id")?.textContent, "!4021");
  const target = row.querySelector(":scope > td.fix-ado-table-target");
  assert.equal(target?.textContent, "Webshop → main");
  assert.equal(target?.querySelector(".fix-ado-table-branch")?.textContent, "main");
  const workItem = row.querySelector(":scope > td.fix-ado-table-work-item");
  assert.equal(workItem?.textContent, "#77");
  assert.equal(isIdCell(row), true);
});

test("marks the Created by me list, which lists only your own pull requests and so has no Author column", () => {
  assert.equal(isMarkedCreatedByMe("Created by me"), true);
  assert.equal(isMarkedCreatedByMe("Assigned to me"), false);
});

/** The row's age as it shows, its tooltip, and whether it shows as stale. */
function ageOf(row: Element): { text: string; tooltip: string | null; isStale: boolean } {
  const cell = row.querySelector<HTMLElement>('[aria-colindex="5"]');
  assert.ok(cell);
  return {
    isStale: Object.hasOwn(cell.dataset, "fixAdoIsStale"),
    text: cell.querySelector(".fix-ado-table-age")?.textContent ?? "",
    tooltip: cell.getAttribute("title"),
  };
}

test("shows the age as how long ago, and u for updated, with the full time as the tooltip", () => {
  const { document } = createList().window;
  showTableRows(document, true, NOW);
  assert.deepEqual(ageOf(rowOf(document)), {
    isStale: false,
    text: "3d u",
    tooltip: "Updated 3 days ago",
  });
  assert.equal(
    document.querySelector(".fix-ado-table-head-age")?.getAttribute("title"),
    "c: created, u: updated, p: published",
  );
});

test("shows the publish time as p where Published since shows it, stale when it is too long ago", () => {
  const { document } = createList().window;
  const published = document.createElement("div");
  published.className = "fix-ado-published-since fix-ado-published-since-too-long";
  published.textContent = "Published 5 hours ago";
  document.querySelector('[aria-colindex="5"] .bolt-table-cell-content')?.append(published);
  showTableRows(document, true, NOW);
  assert.deepEqual(ageOf(rowOf(document)), {
    isStale: true,
    text: "5h p",
    tooltip: "Published 5 hours ago",
  });
});

test("shows an age under a minute as now", () => {
  const { document } = createList().window;
  showTableRows(document, true, Date.parse("2026-01-10T12:00:30.000Z"));
  assert.equal(ageOf(rowOf(document)).text, "now u");
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
  const { document } = createList("Created by me").window;
  showTableRows(document, true);
  showTableRows(document, false);
  assert.equal(document.querySelector('[class*="fix-ado-table"]'), null);
  assert.equal(
    document.querySelector("[title], [data-fix-ado-created-by-me], [data-fix-ado-is-stale]"),
    null,
  );
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
