import { createFoldToggle, showFoldToggleState } from "./fold-toggle.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

const LABELS = { folded: "Show commits", name: "Commits", open: "Hide commits" };

test("a fold toggle keeps one name, and says by its expanded state whether it is open", () => {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const toggle = createFoldToggle(document, "fix-ado-test-toggle");
  showFoldToggleState(toggle, true, LABELS);
  assert.deepEqual(
    [toggle.getAttribute("aria-label"), toggle.getAttribute("aria-expanded"), toggle.title],
    ["Commits", "true", "Hide commits"],
  );
  showFoldToggleState(toggle, false, LABELS);
  assert.deepEqual(
    [toggle.getAttribute("aria-label"), toggle.getAttribute("aria-expanded"), toggle.title],
    ["Commits", "false", "Show commits"],
  );
});
