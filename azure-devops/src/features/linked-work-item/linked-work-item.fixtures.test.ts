import { findPullRequestRows, showLinkedWorkItem } from "../../pull-requests/pr-list.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

/** The first row of a captured page: "pr-list" or "pr-inbox". */
function firstCapturedRow(page: string): HTMLElement {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const root = buildFixtureDom(document, fixtures.read(`${page}.html`));
  if (root === null) {
    throw new Error("the fixture has no root element");
  }
  document.body.append(root);
  const [first] = findPullRequestRows(document, "/fake-org");
  assert.ok(first !== undefined, `${page} has a pull request row`);
  return first.row;
}

const shownLabels = (row: HTMLElement): Element[] => [
  ...row.querySelectorAll(".fix-ado-linked-work-item"),
];

for (const page of ["pr-list", "pr-inbox"]) {
  test(
    `${page}: the work item goes at the end of the line under the title`,
    { skip: fixtures.skip },
    () => {
      const row = firstCapturedRow(page);
      const [, secondLine] = row.querySelectorAll(".bolt-table-two-line-cell-item");
      const textBefore = secondLine?.textContent ?? "";
      showLinkedWorkItem(row, "#123 Fix the login form");

      const [label] = shownLabels(row);
      assert.equal(label?.textContent, "#123 Fix the login form");
      assert.equal(label?.closest(".bolt-table-two-line-cell-item"), secondLine);
      assert.equal(label?.parentElement?.lastElementChild, label);
      assert.equal(secondLine?.textContent, `${textBefore}#123 Fix the login form`);
    },
  );
}

test("showing the work item again adds no second label", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow("pr-list");
  showLinkedWorkItem(row, "#123 Fix the login form");
  showLinkedWorkItem(row, "Multiple work items");
  assert.deepEqual(
    shownLabels(row).map((label) => label.textContent),
    ["Multiple work items"],
  );
});

test("without a linked work item, the label goes", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow("pr-list");
  showLinkedWorkItem(row, "#123 Fix the login form");
  showLinkedWorkItem(row, null);
  assert.deepEqual(shownLabels(row), []);
});
