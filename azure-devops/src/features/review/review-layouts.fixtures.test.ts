import { KEY, loadReviewPage } from "./review.test-page.ts";
import type { LineAnchor } from "./review-store.ts";
import type { ReviewPage } from "./review.test-page.ts";
import assert from "node:assert/strict";
import { fixtures } from "../../pull-requests/captured-pull-request.test-page.ts";
import { pixels } from "./editor-comment-boxes.ts";
import { test } from "node:test";

const { skip } = fixtures;
const CARD = ".fix-ado-review-card-row";
const SPACER = ".fix-ado-review-spacer-row";
const PANE = ".repos-summary-diff-blocks";

/** The first added line in the right pane of a captured side-by-side page. */
function addedLineOf({ document }: ReviewPage): { anchor: LineAnchor; lineRow: Element } {
  const cell = document.querySelector<HTMLElement>(
    ".repos-summary-diff-splitter .repos-line-content.added[data-mline]",
  );
  const lineRow = cell?.closest(".repos-diff-contents-row") ?? null;
  const filePath = cell
    ?.closest(".repos-summary-header")
    ?.querySelector(":scope > div:first-child .secondary-text.text-ellipsis")
    ?.textContent.trim();
  assert.ok(cell !== null && lineRow !== null && filePath !== undefined);
  const anchor: LineAnchor = {
    filePath,
    iteration: null,
    line: Number(cell.dataset.mline),
    lineLength: 1,
    side: "right",
  };
  return { anchor, lineRow };
}

/** A captured side-by-side page with one pending comment on an added line. */
function sideBySidePage(): { page: ReviewPage; lineRow: Element; id: string } {
  const page = loadReviewPage("pr-files-side-by-side-pending");
  const { anchor, lineRow } = addedLineOf(page);
  const { id } = page.store.add(KEY, { anchor, content: "Why this pattern?" });
  page.sync();
  return { id, lineRow, page };
}

test("in the side-by-side layout a card sits in the column of the code", { skip }, () => {
  const { lineRow, page } = sideBySidePage();
  const cards = [...page.document.querySelectorAll(CARD)];
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.previousElementSibling, lineRow);
  const cellsBeforeCode = [...lineRow.children].findIndex((cell) =>
    cell.classList.contains("repos-line-content"),
  );
  assert.equal(cards[0]?.children.length, cellsBeforeCode + 1);
});

test(
  "in the side-by-side layout the other pane gets a spacer, which goes when the card goes",
  { skip },
  () => {
    const { id, lineRow, page } = sideBySidePage();
    page.sync();
    const spacers = [...page.document.querySelectorAll(SPACER)];
    assert.equal(spacers.length, 1);
    const [ownPane, spacerPane] = [lineRow.closest(PANE), spacers[0]?.closest(PANE)];
    assert.ok(spacerPane !== ownPane && spacerPane !== null && spacerPane !== undefined);
    assert.equal(
      spacerPane.closest(".repos-summary-diff-splitter"),
      lineRow.closest(".repos-summary-diff-splitter"),
    );
    page.store.remove(KEY, id);
    page.sync();
    assert.deepEqual([...page.document.querySelectorAll(`${CARD}, ${SPACER}`)], []);
  },
);

test("in the inline layout a card needs no spacer", { skip }, () => {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  page.button("Start a review").click();
  page.sync();
  assert.equal(page.document.querySelectorAll(CARD).length, 1);
  assert.equal(page.document.querySelector(SPACER), null);
});

const LIST = ".fix-ado-review-file-pending";

/** The captured single-file view, with the path it shows above its editor. */
function singleFilePage(): { page: ReviewPage; filePath: string } {
  const page = loadReviewPage("pr-files-single-file-composer");
  const filePath = page.document
    .querySelector(".repos-compare-toolbar .secondary-text.text-ellipsis")
    ?.textContent.trim();
  assert.ok(filePath !== undefined && filePath !== "");
  page.sync();
  return { filePath, page };
}

/** The number of the line whose row ends where the comment box's zone starts. */
function lineAboveBox({ document }: ReviewPage): number {
  const zone = document.querySelector<HTMLElement>(".zone-widget");
  const rows = zone
    ?.closest(".monaco-editor")
    ?.querySelectorAll<HTMLElement>(".margin-view-overlays > div");
  const row = [...(rows ?? [])].find(
    (candidate) =>
      pixels(candidate, "top") + pixels(candidate, "height") === pixels(zone ?? null, "top"),
  );
  return Number(row?.querySelector(".line-numbers")?.textContent);
}

test("in the single-file view a comment is added on the line above its box", { skip }, () => {
  const { filePath, page } = singleFilePage();
  const line = lineAboveBox(page);
  assert.ok(line > 0);
  const textarea = page.document.querySelector<HTMLTextAreaElement>(
    'textarea[class*="threadId--"]:not([aria-hidden])',
  );
  assert.ok(textarea !== null);
  page.type(textarea, "Why this pattern?");
  page.button("Start a review").click();
  const [comment] = page.store.pending(KEY);
  assert.deepEqual(
    { ...comment?.anchor, iteration: null, lineLength: 0 },
    { filePath, iteration: null, line, lineLength: 0, side: "right" },
  );
  assert.ok((comment?.anchor?.lineLength ?? 0) > 0);
});

test(
  "a tall box whose line the editor no longer draws still adds its comment on that line",
  { skip },
  () => {
    const { page } = singleFilePage();
    const line = lineAboveBox(page);
    const textarea = page.document.querySelector<HTMLTextAreaElement>(
      'textarea[class*="threadId--"]:not([aria-hidden])',
    );
    assert.ok(textarea !== null);
    // The editor draws only the lines in view: scrolled to the end of a tall box, its line is gone.
    for (const row of page.document.querySelectorAll(".margin-view-overlays > div")) {
      row.remove();
    }
    page.type(textarea, "A long comment");
    page.sync();
    page.button("Start a review").click();
    assert.equal(page.store.pending(KEY)[0]?.anchor?.line, line);
  },
);

test(
  "the single-file view lists the pending comments on its file, to edit or delete",
  { skip },
  () => {
    const { filePath, page } = singleFilePage();
    const anchor = { filePath, iteration: null, line: 12, lineLength: 30 } as const;
    page.store.add(KEY, { anchor: { ...anchor, side: "right" }, content: "On this file" });
    page.store.add(KEY, {
      anchor: { ...anchor, filePath: "/src/other.ts", side: "right" },
      content: "On another file",
    });
    page.sync();
    page.sync();
    const lists = [...page.document.querySelectorAll(LIST)];
    assert.equal(lists.length, 1);
    assert.equal(lists[0]?.querySelector("summary")?.textContent, "1 pending comment in this file");
    assert.deepEqual(
      [
        ...(lists[0]?.querySelectorAll(".fix-ado-review-card-note, .fix-ado-review-card-text") ??
          []),
      ].map((part) => part.textContent),
      ["Line 12", "On this file"],
    );
    page.button("Delete comment").click();
    assert.equal(page.document.querySelector(LIST), null);
    assert.deepEqual(
      page.store.pending(KEY).map(({ content }) => content),
      ["On another file"],
    );
  },
);

test("the all-files view shows no list of pending comments", { skip }, () => {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  page.button("Start a review").click();
  assert.equal(page.document.querySelector(LIST), null);
});

test(
  "without a path above the editor, the single-file view reads it from the address",
  { skip },
  () => {
    const { page } = singleFilePage();
    page.document.querySelector(".repos-compare-toolbar .secondary-text.text-ellipsis")?.remove();
    page.document.defaultView?.history.replaceState(null, "", "?_a=files&path=/src/totals.ts");
    page.store.add(KEY, {
      anchor: {
        filePath: "/src/totals.ts",
        iteration: null,
        line: 12,
        lineLength: 30,
        side: "right",
      },
      content: "On this file",
    });
    page.sync();
    assert.equal(page.document.querySelectorAll(`${LIST} .fix-ado-review-listed`).length, 1);
  },
);

test("the list also shows for a file the editor shows without a diff", { skip }, () => {
  const { filePath, page } = singleFilePage();
  for (const editor of page.document.querySelectorAll(".repos-diff-editor, .monaco-diff-editor")) {
    editor.classList.remove("repos-diff-editor", "monaco-diff-editor");
  }
  page.store.add(KEY, {
    anchor: { filePath, iteration: null, line: 12, lineLength: 30, side: "right" },
    content: "On this file",
  });
  page.sync();
  assert.equal(page.document.querySelectorAll(`${LIST} .fix-ado-review-listed`).length, 1);
});
