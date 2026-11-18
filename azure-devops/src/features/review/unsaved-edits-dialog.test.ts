import { pressEscape, stubDialogMethods } from "./dialog.test-page.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { openUnsavedEditsDialog } from "./unsaved-edits-dialog.ts";
import { test } from "node:test";

function openDialog(): { answers: boolean[]; dialog: HTMLDialogElement } {
  const { window } = new JSDOM("<!doctype html><body></body>");
  stubDialogMethods(window);
  const answers: boolean[] = [];
  openUnsavedEditsDialog({
    count: 2,
    document: window.document,
    onAnswer: (shouldSave) => {
      answers.push(shouldSave);
    },
  });
  const dialog = window.document.querySelector("dialog");
  assert.ok(dialog !== null);
  return { answers, dialog };
}

test("the question is named by its visible heading", () => {
  const { dialog } = openDialog();
  const heading = dialog.ownerDocument.querySelector(
    `#${dialog.getAttribute("aria-labelledby") ?? ""}`,
  );
  assert.equal(heading?.textContent, "Save your edits?");
});

test("Esc goes back to the edits, like Cancel, and leaves no dialog behind", () => {
  const { answers, dialog } = openDialog();
  assert.equal(pressEscape(dialog), true);
  assert.deepEqual([answers, dialog.isConnected], [[], false]);
});
