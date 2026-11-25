import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showListSwitch } from "./list-switch.ts";
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

const FRUIT_SWITCH = { className: "fix-ado-fruit-switch", label: "Show fruit" };
const NUT_SWITCH = { className: "fix-ado-nut-switch", label: "Show nuts" };

const pageOf = (html: string): Document => new JSDOM(html).window.document;

const ignoreToggle = (): void => undefined;

const off = { isOn: false, onToggle: ignoreToggle };

const switchOf = (document: Document, className = FRUIT_SWITCH.className): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.${className}`);

test("on a repository list, the switch sits in the tab bar, before its buttons, once", () => {
  const document = pageOf(REPOSITORY_LIST);
  showListSwitch(document, FRUIT_SWITCH, off);
  showListSwitch(document, FRUIT_SWITCH, off);
  assert.equal(document.querySelectorAll(".fix-ado-fruit-switch").length, 1);
  const toggle = switchOf(document);
  assert.equal(toggle?.parentElement?.className, "bolt-tabbar");
  assert.equal(toggle?.nextElementSibling?.className, "bolt-header-commandbar");
  assert.equal(toggle?.getAttribute("role"), "switch");
  assert.equal(toggle?.textContent, "Show fruit");
});

test("in the inbox, the switch sits above the lists", () => {
  const document = pageOf(INBOX);
  showListSwitch(document, FRUIT_SWITCH, off);
  const bar = document.querySelector(".page-content")?.firstElementChild;
  assert.equal(bar?.className, "fix-ado-list-switch-bar");
  assert.equal(bar?.firstElementChild, switchOf(document));
});

test("the switch is on while its state is on", () => {
  const document = pageOf(REPOSITORY_LIST);
  showListSwitch(document, FRUIT_SWITCH, off);
  assert.equal(switchOf(document)?.getAttribute("aria-checked"), "false");
  showListSwitch(document, FRUIT_SWITCH, { isOn: true, onToggle: ignoreToggle });
  assert.equal(switchOf(document)?.getAttribute("aria-checked"), "true");
});

test("a click calls the latest onToggle", () => {
  const document = pageOf(INBOX);
  const calls: string[] = [];
  showListSwitch(document, FRUIT_SWITCH, {
    isOn: false,
    onToggle: () => {
      calls.push("first");
    },
  });
  showListSwitch(document, FRUIT_SWITCH, {
    isOn: false,
    onToggle: () => {
      calls.push("second");
    },
  });
  switchOf(document)?.click();
  assert.deepEqual(calls, ["second"]);
});

test("two switches in a tab bar stay where they are on the next sync", () => {
  const { window } = new JSDOM(REPOSITORY_LIST);
  const { document } = window;
  showListSwitch(document, FRUIT_SWITCH, off);
  showListSwitch(document, NUT_SWITCH, off);
  const observer = new window.MutationObserver(ignoreToggle);
  observer.observe(document.body, { childList: true, subtree: true });
  showListSwitch(document, FRUIT_SWITCH, off);
  showListSwitch(document, NUT_SWITCH, off);
  assert.deepEqual(observer.takeRecords(), []);
});

test("in the inbox, removing one switch keeps the bar for the other", () => {
  const document = pageOf(INBOX);
  showListSwitch(document, FRUIT_SWITCH, off);
  showListSwitch(document, NUT_SWITCH, off);
  showListSwitch(document, FRUIT_SWITCH, null);
  assert.equal(switchOf(document), null);
  assert.equal(
    document.querySelector(".fix-ado-list-switch-bar")?.firstElementChild,
    switchOf(document, NUT_SWITCH.className),
  );
});

for (const [name, html] of [
  ["repository list", REPOSITORY_LIST],
  ["inbox", INBOX],
]) {
  test(`${name}: without lists on the page, there is no switch`, () => {
    const document = pageOf(html);
    showListSwitch(document, FRUIT_SWITCH, off);
    showListSwitch(document, FRUIT_SWITCH, null);
    assert.equal(switchOf(document), null);
    assert.equal(document.querySelector(".fix-ado-list-switch-bar"), null);
  });
}
