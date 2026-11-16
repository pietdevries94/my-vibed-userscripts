import { KEY, loadReviewPage } from "./review.test-page.ts";
import type { FakeEditors } from "./code-editor.test-page.ts";
import type { ReviewPage } from "./review.test-page.ts";
import assert from "node:assert/strict";
import { attachFakeEditors } from "./code-editor.test-page.ts";
import { fixtures } from "../../pull-requests/captured-pull-request.test-page.ts";
import { test } from "node:test";

const { skip } = fixtures;
const LIST = ".fix-ado-review-file-pending";
const PATH = ".repos-compare-toolbar .secondary-text.text-ellipsis";

interface EditorPage {
  page: ReviewPage;
  editors: FakeEditors;
  /** Adds a pending comment on a line of the shown file. */
  comment: (content: string, side?: "left" | "right") => string;
}

/** The captured single-file view with a code editor the script can reach. */
function editorPage(isInline = true): EditorPage {
  const page = loadReviewPage("pr-files-single-file-composer");
  const filePath = page.document.querySelector(PATH)?.textContent.trim() ?? "";
  const editors = attachFakeEditors(page.document, isInline);
  return {
    comment: (content, side = "right") =>
      page.store.add(KEY, {
        anchor: { filePath, iteration: null, line: 12, lineLength: 30, side },
        content,
      }).id,
    editors,
    page,
  };
}

test("in the single-file view a pending comment shows as a card under its line", { skip }, () => {
  const { comment, editors, page } = editorPage();
  comment("Why this pattern?");
  page.sync();
  page.sync();
  assert.deepEqual(
    editors.zones.right.map(({ afterLineNumber }) => afterLineNumber),
    [12],
  );
  const [card, ...others] = editors.overlays;
  assert.deepEqual(others, []);
  assert.equal(card?.querySelector(".fix-ado-review-pending")?.textContent, "Pending");
  assert.equal(card?.querySelector(".fix-ado-review-card-text")?.textContent, "Why this pattern?");
  assert.deepEqual([card?.style.top, card?.style.display], ["216px", "block"]);
  editors.scrollBy(100);
  assert.equal(card?.style.top, "116px");
  assert.equal(page.document.querySelector(LIST), null);
});

test("a card in the editor can be edited, and deleting it gives the room back", { skip }, () => {
  const { comment, editors, page } = editorPage();
  comment("First wording");
  page.sync();
  page.button("Edit").click();
  const editor = editors.overlays[0]?.querySelector("textarea");
  assert.ok(editor !== null && editor !== undefined);
  page.type(editor, "Better wording");
  page.button("Update comment").click();
  assert.deepEqual(
    editors.overlays.map((card) => card.querySelector(".fix-ado-review-card-text")?.textContent),
    ["Better wording"],
  );
  assert.equal(editors.zones.right.length, 1);
  page.button("Delete comment").click();
  assert.deepEqual([editors.overlays, editors.zones.right, page.store.pending(KEY)], [[], [], []]);
});

test("when the editor shows another file, the cards of the first file go", { skip }, () => {
  const { comment, editors, page } = editorPage();
  comment("On the first file");
  page.sync();
  const path = page.document.querySelector(PATH);
  assert.ok(path !== null);
  path.textContent = "/src/another-file.ts";
  editors.showAnotherFile();
  page.sync();
  assert.deepEqual([editors.overlays, editors.zones.right], [[], []]);
  assert.equal(page.store.pending(KEY).length, 1);
});

test(
  "a comment on a removed line goes in the editor of the file before the change",
  { skip },
  () => {
    const { comment, editors, page } = editorPage(false);
    comment("Why remove this?", "left");
    page.sync();
    assert.deepEqual([editors.zones.left.length, editors.zones.right.length], [1, 0]);
  },
);

test("in an inline diff a comment on a removed line shows in the list", { skip }, () => {
  const { comment, editors, page } = editorPage();
  comment("Why remove this?", "left");
  page.sync();
  assert.deepEqual([editors.zones.left, editors.overlays], [[], []]);
  assert.equal(page.document.querySelectorAll(`${LIST} .fix-ado-review-listed`).length, 1);
});
