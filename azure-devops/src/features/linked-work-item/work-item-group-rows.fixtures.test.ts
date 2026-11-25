import { findPullRequestRows, isDraftRow } from "../../pull-requests/pr-list.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { showWorkItemGroups } from "./work-item-group-rows.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

/** Jsdom has no moveBefore. Chrome and Firefox do; for a node inside the same parent it is insertBefore. */
function moveBefore(this: Element, node: Node, child: Node | null): void {
  this.insertBefore(node, child);
}

function capturedPage(page: string): Document {
  const { window } = new JSDOM("<!doctype html><body></body>");
  window.Element.prototype.moveBefore = moveBefore;
  const { document } = window;
  const root = buildFixtureDom(document, fixtures.read(`${page}.html`));
  if (root === null) {
    throw new Error("the fixture has no root element");
  }
  document.body.append(root);
  return document;
}

/** The first list on the page with at least `count` pull requests. */
function listWithRows(document: Document, count: number): HTMLElement {
  const list = [...document.querySelectorAll<HTMLElement>("table.repos-pr-list > tbody")].find(
    (tbody) => findPullRequestRows(tbody, "/fake-org").length >= count,
  );
  assert.ok(list !== undefined, `a list with ${count} pull requests`);
  return list;
}

/** The list's pull request ids and group titles, in the order they show. */
function shownOrder(list: HTMLElement): string[] {
  return [...list.children].flatMap((child) => {
    if (child.classList.contains("fix-ado-work-item-group")) {
      return [`group ${child.textContent}`];
    }
    const href = child.getAttribute("href");
    return href === null ? [] : [href.split("/").at(-1) ?? ""];
  });
}

const rowsOf = (list: HTMLElement): HTMLElement[] =>
  findPullRequestRows(list, "/fake-org").map(({ row }) => row);

for (const page of ["pr-inbox-win98", "pr-list-win98-active"]) {
  test(`${page}: groups the rows of a list, and puts them back`, { skip: fixtures.skip }, () => {
    const list = listWithRows(capturedPage(page), 3);
    const before = shownOrder(list);
    const [first, second, third, ...rest] = rowsOf(list);
    const ids = [first, second, third].map((row) => row?.getAttribute("href")?.split("/").at(-1));

    showWorkItemGroups(list, "/fake-org", [
      { key: "9", label: "#9", rows: [first, third], title: "Basket", workItemId: 9 },
      {
        key: "none",
        label: "No work item",
        rows: [second, ...rest],
        title: null,
        workItemId: null,
      },
    ]);
    assert.deepEqual(shownOrder(list).slice(0, 5), [
      "group #9 Basket",
      ids[0],
      ids[2],
      "group No work item",
      ids[1],
    ]);
    const link = list.querySelector<HTMLAnchorElement>(".fix-ado-work-item-group a");
    assert.equal(link?.getAttribute("href"), "/fake-org/_workitems/edit/9");
    assert.equal(link?.textContent, "#9");
    assert.equal(link?.target, "_blank");
    assert.equal(
      list.querySelector(".fix-ado-work-item-group td")?.getAttribute("colspan"),
      String(list.closest("table")?.querySelectorAll("col").length),
    );

    showWorkItemGroups(list, "/fake-org", null);
    assert.deepEqual(shownOrder(list), before);
  });
}

test("grouping again in the same order changes nothing", { skip: fixtures.skip }, () => {
  const document = capturedPage("pr-list-win98-active");
  const list = listWithRows(document, 2);
  const [first, second, ...rest] = rowsOf(list);
  const groups = [
    { key: "1", label: "#1", rows: [second, ...rest], title: null, workItemId: 1 },
    { key: "2", label: "#2", rows: [first], title: null, workItemId: 2 },
  ];
  showWorkItemGroups(list, "/fake-org", groups);
  const changes: MutationRecord[] = [];
  const view = document.defaultView;
  assert.ok(view !== null);
  const observer = new view.MutationObserver((records) => {
    changes.push(...records);
  });
  observer.observe(list, { attributes: true, childList: true, subtree: true });
  showWorkItemGroups(list, "/fake-org", groups);
  changes.push(...observer.takeRecords());
  assert.deepEqual(changes, []);
});

test(
  "pr-list-win98: marks a group whose pull requests are all drafts",
  { skip: fixtures.skip },
  () => {
    const list = listWithRows(capturedPage("pr-list-win98"), 3);
    const rows = rowsOf(list);
    const drafts = rows.filter((row) => isDraftRow(row));
    const others = rows.filter((row) => !isDraftRow(row));
    assert.ok(drafts.length > 0 && others.length > 0);
    const draftsOnly = (): string[] =>
      [
        ...list.querySelectorAll<HTMLElement>(".fix-ado-work-item-group[data-fix-ado-drafts-only]"),
      ].map((row) => row.dataset.fixAdoWorkItemGroup ?? "");
    const grouped = (draftRows: HTMLElement[], mixedRows: HTMLElement[]): void => {
      showWorkItemGroups(list, "/fake-org", [
        { key: "1", label: "#1", rows: draftRows, title: null, workItemId: 1 },
        { key: "2", label: "#2", rows: mixedRows, title: null, workItemId: 2 },
      ]);
    };

    grouped(drafts, others);
    assert.deepEqual(draftsOnly(), ["1"]);

    grouped(drafts.slice(1), [...others, ...drafts.slice(0, 1)]);
    assert.deepEqual(draftsOnly(), drafts.length > 1 ? ["1"] : []);

    grouped([...drafts, ...others], []);
    assert.deepEqual(draftsOnly(), []);
  },
);
