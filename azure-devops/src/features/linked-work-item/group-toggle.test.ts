import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showGroupToggle } from "./group-toggle.ts";
import { test } from "node:test";

/** A repository list: a tab bar with tabs and a Filter button, then the lists. */
const REPOSITORY_LIST = `<!doctype html><body>
  <div class="bolt-tabbar"><div class="bolt-tabbar-tabs" role="tablist"></div><div class="bolt-header-commandbar"></div></div>
  <div class="page-content page-content-top"><div class="repos-pr-section-card"></div></div>
</body>`;

/** The inbox: the lists, without a tab bar of their own. */
const INBOX = `<!doctype html><body>
  <div class="page-content page-content-top"><div class="repos-pr-section-card"></div></div>
</body>`;

const pageOf = (html: string): Document => new JSDOM(html).window.document;

const ignoreToggle = (): void => undefined;

const switchOf = (document: Document): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>(".fix-ado-group-toggle");

test("on a repository list, the switch sits in the tab bar, before its buttons, once", () => {
  const document = pageOf(REPOSITORY_LIST);
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  assert.equal(document.querySelectorAll(".fix-ado-group-toggle").length, 1);
  const toggle = switchOf(document);
  assert.equal(toggle?.parentElement?.className, "bolt-tabbar");
  assert.equal(toggle?.nextElementSibling?.className, "bolt-header-commandbar");
  assert.equal(toggle?.getAttribute("role"), "switch");
  assert.equal(toggle?.textContent, "Group by work item");
});

test("in the inbox, the switch sits above the lists", () => {
  const document = pageOf(INBOX);
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  const bar = document.querySelector(".page-content")?.firstElementChild;
  assert.equal(bar?.className, "fix-ado-group-toggle-bar");
  assert.equal(bar?.firstElementChild, switchOf(document));
});

test("the switch is on while the lists are grouped", () => {
  const document = pageOf(REPOSITORY_LIST);
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  assert.equal(switchOf(document)?.getAttribute("aria-checked"), "false");
  showGroupToggle(document, { isGrouped: true, onToggle: ignoreToggle });
  assert.equal(switchOf(document)?.getAttribute("aria-checked"), "true");
});

test("a click calls the latest onToggle", () => {
  const document = pageOf(INBOX);
  const calls: string[] = [];
  showGroupToggle(document, {
    isGrouped: false,
    onToggle: () => {
      calls.push("first");
    },
  });
  showGroupToggle(document, {
    isGrouped: false,
    onToggle: () => {
      calls.push("second");
    },
  });
  switchOf(document)?.click();
  assert.deepEqual(calls, ["second"]);
});

for (const [name, html] of [
  ["repository list", REPOSITORY_LIST],
  ["inbox", INBOX],
]) {
  test(`${name}: without lists on the page, there is no switch`, () => {
    const document = pageOf(html);
    showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
    showGroupToggle(document, null);
    assert.equal(document.querySelector(".fix-ado-group-toggle"), null);
    assert.equal(document.querySelector(".fix-ado-group-toggle-bar"), null);
  });
}
