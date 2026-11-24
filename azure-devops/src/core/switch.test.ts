import { createSwitch, showSwitchOn } from "./switch.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

const newDocument = (): Document => new JSDOM("<!doctype html><body></body>").window.document;

test("a switch is a button with the switch role, off, with its label after the pill", () => {
  const toggle = createSwitch(newDocument(), "Group by work item");
  assert.equal(toggle.type, "button");
  assert.equal(toggle.getAttribute("role"), "switch");
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  assert.equal(toggle.textContent, "Group by work item");
  assert.equal(toggle.firstElementChild?.className, "fix-ado-switch-pill");
  assert.equal(toggle.firstElementChild?.getAttribute("aria-hidden"), "true");
  assert.ok(toggle.classList.contains("fix-ado-switch"));
});

test("showing the state writes aria-checked only when it changes", () => {
  const document = newDocument();
  const toggle = createSwitch(document, "Group by work item");
  document.body.append(toggle);
  showSwitchOn(toggle, true);
  assert.equal(toggle.getAttribute("aria-checked"), "true");
  const changes: MutationRecord[] = [];
  const view = document.defaultView;
  assert.ok(view !== null);
  const observer = new view.MutationObserver((records) => {
    changes.push(...records);
  });
  observer.observe(toggle, { attributes: true });
  showSwitchOn(toggle, true);
  changes.push(...observer.takeRecords());
  assert.deepEqual(changes, []);
});
