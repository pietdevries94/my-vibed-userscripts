import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showGroupToggle } from "./group-toggle.ts";
import { test } from "node:test";

function listPage(): Document {
  const { document } = new JSDOM(
    `<!doctype html><body><div class="page-content page-content-top"><div class="repos-pr-section-card"></div></div></body>`,
  ).window;
  return document;
}

const ignoreToggle = (): void => undefined;

const toggleOf = (document: Document): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>(".fix-ado-group-toggle button");

test("puts the toggle above the lists, once", () => {
  const document = listPage();
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  const bars = document.querySelectorAll(".fix-ado-group-toggle");
  assert.equal(bars.length, 1);
  assert.equal(document.querySelector(".page-content")?.firstElementChild, bars[0]);
  assert.equal(toggleOf(document)?.textContent, "Group by work item");
  assert.equal(toggleOf(document)?.type, "button");
});

test("the toggle says whether the lists are grouped", () => {
  const document = listPage();
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  assert.equal(toggleOf(document)?.getAttribute("aria-pressed"), "false");
  showGroupToggle(document, { isGrouped: true, onToggle: ignoreToggle });
  assert.equal(toggleOf(document)?.getAttribute("aria-pressed"), "true");
});

test("a click calls the latest onToggle", () => {
  const document = listPage();
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
  toggleOf(document)?.click();
  assert.deepEqual(calls, ["second"]);
});

test("without lists on the page, there is no toggle", () => {
  const document = listPage();
  showGroupToggle(document, { isGrouped: false, onToggle: ignoreToggle });
  showGroupToggle(document, null);
  assert.equal(document.querySelector(".fix-ado-group-toggle"), null);
});
