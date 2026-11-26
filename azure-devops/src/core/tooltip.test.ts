import type { DOMWindow } from "jsdom";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { startTooltips } from "./tooltip.ts";
import { test } from "node:test";

function createPage(): { document: Document; trigger: HTMLElement; window: DOMWindow } {
  const { window } = new JSDOM(`<!doctype html><body>
    <button data-fix-ado-tooltip="Doe, Jane">JD</button>
    <div class="bolt-portal-host"></div></body>`);
  const trigger = window.document.querySelector("button");
  assert.ok(trigger);
  return { document: window.document, trigger, window };
}

const shownTooltip = (document: Document): Element | null =>
  document.querySelector('.bolt-portal-host .bolt-tooltip[role="tooltip"] .bolt-tooltip-content');

test("shows Azure DevOps's own tooltip on keyboard focus, and links it to the element", () => {
  const { document, trigger, window } = createPage();
  startTooltips(document);
  trigger.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  assert.equal(shownTooltip(document)?.textContent, "Doe, Jane");
  const id = trigger.getAttribute("aria-describedby") ?? "";
  assert.equal(document.querySelector(`#${id}`)?.getAttribute("role"), "tooltip");
});

test("takes the tooltip away when the focus leaves, or on Escape", () => {
  const { document, trigger, window } = createPage();
  startTooltips(document);
  trigger.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  trigger.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
  assert.equal(shownTooltip(document), null);
  assert.equal(trigger.hasAttribute("aria-describedby"), false);
  trigger.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  document.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  assert.equal(shownTooltip(document), null);
});

test("shows the tooltip a moment after the pointer comes over the element, not at once", async () => {
  const { document, trigger, window } = createPage();
  startTooltips(document, { hoverDelayMs: 1 });
  trigger.dispatchEvent(new window.MouseEvent("pointerover", { bubbles: true }));
  assert.equal(shownTooltip(document), null);
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
  assert.equal(shownTooltip(document)?.textContent, "Doe, Jane");
});

test("runs once per page, however many times it is started", () => {
  const { document, trigger, window } = createPage();
  startTooltips(document);
  startTooltips(document);
  trigger.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  assert.equal(document.querySelectorAll(".bolt-tooltip").length, 1);
});

test("stops showing tooltips when stopped", () => {
  const { document, trigger, window } = createPage();
  const stop = startTooltips(document);
  stop();
  trigger.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  assert.equal(shownTooltip(document), null);
});
