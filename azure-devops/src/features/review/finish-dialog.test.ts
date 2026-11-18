import { pressEscape, stubDialogMethods } from "./dialog.test-page.ts";
import { JSDOM } from "jsdom";
import type { SubmitResult } from "./review-submit.ts";
import assert from "node:assert/strict";
import { openFinishDialog } from "./finish-dialog.ts";
import { test } from "node:test";

const PENDING = [
  { anchor: null, content: "A pending comment", id: "1", isAttempted: false, postedThreadId: null },
];

interface DialogPage {
  dialog: HTMLDialogElement;
  /** Ends the running submit with this result. */
  finishSubmit: (result: SubmitResult) => void;
}

function openDialogPage(): DialogPage {
  const { window } = new JSDOM("<!doctype html><body></body>");
  stubDialogMethods(window);
  let finishSubmit: ((result: SubmitResult) => void) | null = null;
  openFinishDialog({
    discard: () => {
      assert.fail("nothing is discarded");
    },
    document: window.document,
    onSubmitted: () => {
      assert.fail("nothing is submitted");
    },
    pending: () => PENDING,
    submit: async () =>
      new Promise<SubmitResult>((resolve) => {
        finishSubmit = resolve;
      }),
  });
  const dialog = window.document.querySelector("dialog");
  assert.ok(dialog !== null);
  return {
    dialog,
    finishSubmit: (result) => {
      assert.ok(finishSubmit !== null, "a submit is running");
      finishSubmit(result);
    },
  };
}

function button(dialog: HTMLDialogElement, text: string): HTMLButtonElement {
  const found = [...dialog.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text,
  );
  assert.ok(found !== undefined, `the dialog has a "${text}" button`);
  return found;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("Esc does not close the dialog while the review is being posted", async () => {
  const { dialog, finishSubmit } = openDialogPage();
  button(dialog, "Submit review").click();
  assert.equal(pressEscape(dialog), false);
  assert.ok(dialog.isConnected);
  finishSubmit({ failures: [{ httpStatus: 500, id: "1" }], vote: "skipped" });
  await settle();
  assert.match(dialog.querySelector('[role="status"]')?.textContent ?? "", /could not be posted/u);
});

test("Esc closes the dialog when nothing is being posted", () => {
  const { dialog } = openDialogPage();
  assert.equal(pressEscape(dialog), true);
  assert.equal(dialog.isConnected, false);
});

test("the dialog is named by its visible heading and keeps its native role", () => {
  const { dialog } = openDialogPage();
  const heading = dialog.ownerDocument.querySelector(
    `#${dialog.getAttribute("aria-labelledby") ?? ""}`,
  );
  assert.equal(heading?.textContent, "Finish your review");
  assert.deepEqual(
    [dialog.hasAttribute("role"), dialog.hasAttribute("aria-label")],
    [false, false],
  );
});

test("after a failed submit, focus is back on Submit review", async () => {
  const { dialog, finishSubmit } = openDialogPage();
  const submit = button(dialog, "Submit review");
  submit.focus();
  submit.click();
  // A browser moves focus off a button once it is disabled.
  submit.blur();
  finishSubmit({ failures: [{ httpStatus: 500, id: "1" }], vote: "skipped" });
  await settle();
  assert.equal(dialog.ownerDocument.activeElement, submit);
});
