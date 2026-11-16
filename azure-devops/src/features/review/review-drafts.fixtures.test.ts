import { KEY, loadReviewPage } from "./review.test-page.ts";
import type { ReviewPage } from "./review.test-page.ts";
import assert from "node:assert/strict";
import { fixtures } from "../../pull-requests/captured-pull-request.test-page.ts";
import { test } from "node:test";

const { skip } = fixtures;
const CARD = ".fix-ado-review-card-row";
const TREE_ROW = ".repos-changes-explorer-tree tr.bolt-tree-row";
const TREE_TEXT = ".fix-ado-review-tree-row .text-ellipsis";

/** The all-files page with one pending comment whose edit is open, with new text typed. */
function pageWithOpenEdit(): ReviewPage {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  page.button("Start a review").click();
  page.button("Edit").click();
  const editor = page.document.querySelector<HTMLTextAreaElement>(`${CARD} textarea`);
  assert.ok(editor !== null);
  page.type(editor, "Better wording");
  return page;
}

function editorText(page: ReviewPage): string | undefined {
  return page.document.querySelector<HTMLTextAreaElement>(`${CARD} textarea`)?.value;
}

/** A button of the pending card. The capture's own comment box has a "Cancel" too. */
function cardButton(page: ReviewPage, text: string): HTMLButtonElement {
  const button = [...page.document.querySelectorAll<HTMLButtonElement>(`${CARD} button`)].find(
    (candidate) => candidate.textContent === text,
  );
  assert.ok(button !== undefined, `a "${text}" button on the card`);
  return button;
}

function dialogButton(page: ReviewPage, text: string): HTMLButtonElement {
  const button = [...page.document.querySelectorAll<HTMLButtonElement>("dialog button")].find(
    (candidate) => candidate.textContent === text,
  );
  assert.ok(button !== undefined, `a "${text}" button in a dialog`);
  return button;
}

test("an edit survives when the page drops its card and draws it again", { skip }, () => {
  const page = pageWithOpenEdit();
  const [comment] = page.store.pending(KEY);
  page.document.querySelector(CARD)?.remove();
  page.sync();
  assert.equal(editorText(page), "Better wording");
  assert.equal(page.store.pending(KEY)[0]?.content, comment?.content);
  cardButton(page, "Cancel").click();
  assert.equal(editorText(page), undefined);
  cardButton(page, "Edit").click();
  assert.equal(editorText(page), comment?.content);
});

/**
 * The captured single-file view with a pending comment on the file it shows. The path
 * above the editor is a stand-in in the capture; the tree's names make up the real one.
 */
function pageWithCommentOnShownFile(): { page: ReviewPage; id: string } {
  const page = loadReviewPage("pr-files-thread");
  const rows = [...page.document.querySelectorAll(TREE_ROW)];
  const fileIndex = rows.findIndex((row) => row.classList.contains("selected"));
  const shownPath = page.document.querySelector(
    ".repos-compare-toolbar .secondary-text.text-ellipsis",
  );
  assert.ok(fileIndex !== -1 && shownPath !== null);
  const names: string[] = [];
  for (const row of rows.slice(0, fileIndex + 1)) {
    names.length = Number(row.getAttribute("aria-level")) - 1;
    names.push(row.querySelector(".bolt-tree-cell .text-ellipsis")?.textContent.trim() ?? "");
  }
  const filePath = `/${names.join("/")}`;
  shownPath.textContent = filePath;
  const { id } = page.store.add(KEY, {
    anchor: { filePath, iteration: null, line: 1, lineLength: 1, side: "right" },
    content: "First wording",
  });
  return { id, page };
}

test("the file tree shows an unsaved edit after a star, until it is saved", { skip }, () => {
  const { id, page } = pageWithCommentOnShownFile();
  page.sync();
  assert.equal(page.document.querySelector(TREE_TEXT)?.textContent, "First wording");
  // The single-file view of the capture has no editor the script can reach: the card is in the list.
  const edit = page.document.querySelector<HTMLButtonElement>(
    `[data-fix-ado-review-id="${id}"] button`,
  );
  edit?.click();
  const editor = page.document.querySelector<HTMLTextAreaElement>(
    `[data-fix-ado-review-id="${id}"] textarea`,
  );
  assert.ok(editor !== null);
  page.type(editor, "Better wording\nwith a second line");
  assert.equal(page.document.querySelector(TREE_TEXT)?.textContent, "*Better wording");
  assert.equal(page.document.querySelector(`${TREE_TEXT} .margin-right-4`)?.textContent, "*");
  page.button("Update comment").click();
  assert.equal(page.document.querySelector(TREE_TEXT)?.textContent, "Better wording");
});

test("an edit without text stays open", { skip }, () => {
  const page = pageWithOpenEdit();
  const editor = page.document.querySelector<HTMLTextAreaElement>(`${CARD} textarea`);
  assert.ok(editor !== null);
  page.type(editor, "  ");
  page.button("Update comment").click();
  assert.equal(editorText(page), "  ");
});

test('"Submit review" with an edit open asks to save it: "Yes" saves', { skip }, () => {
  const page = pageWithOpenEdit();
  page.document.querySelector<HTMLButtonElement>(".fix-ado-review-header button")?.click();
  assert.equal(
    page.document.querySelector("dialog .fix-ado-review-title")?.textContent,
    "Save your edits?",
  );
  dialogButton(page, "Yes").click();
  assert.equal(page.store.pending(KEY)[0]?.content, "Better wording");
  assert.equal(editorText(page), undefined);
  assert.equal(
    page.document.querySelector("dialog .fix-ado-review-title")?.textContent,
    "Finish your review",
  );
});

test('"No" drops the edit and goes on, "Cancel" keeps it and goes back', { skip }, () => {
  const page = pageWithOpenEdit();
  const [comment] = page.store.pending(KEY);
  const submit = page.document.querySelector<HTMLButtonElement>(".fix-ado-review-header button");
  submit?.click();
  dialogButton(page, "Cancel").click();
  assert.deepEqual(
    [page.document.querySelector("dialog"), editorText(page)],
    [null, "Better wording"],
  );
  submit?.click();
  dialogButton(page, "No").click();
  assert.deepEqual(
    [page.store.pending(KEY)[0]?.content, editorText(page)],
    [comment?.content, undefined],
  );
  assert.equal(
    page.document.querySelector("dialog .fix-ado-review-title")?.textContent,
    "Finish your review",
  );
});
