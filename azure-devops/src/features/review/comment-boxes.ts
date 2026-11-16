// Azure DevOps's own comment boxes for a new thread, and where each one sits: on a
// line of a file, in the all-files or the single-file view, or on the pull request as
// a whole.
import { ZONE_SELECTOR, editorAnchorOf } from "./editor-comment-boxes.ts";
import type { LineAnchor } from "./review-store.ts";

/** Where a comment box sits. The iteration is not on the page. */
type BoxAnchor = { kind: "general" } | ({ kind: "line" } & Omit<LineAnchor, "iteration">);

interface CommentBox {
  textarea: HTMLTextAreaElement;
  /** Azure DevOps's own button that posts the comment at once. */
  postButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement | null;
  anchor: BoxAnchor;
}

const BOX_SELECTOR = ".repos-discussion-thread-reply";
/** A box for a new thread counts down from -1. A reply box has no such class. */
const NEW_THREAD_CLASS = /(?:^|\s)threadId--\d+(?:\s|$)/u;
const DIFF_ROW_SELECTOR = ".repos-diff-contents-row";
const LINE_CELL_SELECTOR = ".repos-line-content";
const FILE_CARD_SELECTOR = ".repos-summary-header";
/** The full path under the file name in a file card's header. */
const FILE_PATH_SELECTOR = ":scope > div:first-child .secondary-text.text-ellipsis";
const OVERVIEW_BOX_SELECTOR = ".repos-comment-card";
/** Parts of a line cell that are not the line's text. */
const NOT_LINE_TEXT_SELECTOR = '.screen-reader-only, [aria-hidden="true"]';

function lineTextOf(cell: Element): string {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a clone of an element is an element
  const copy = cell.cloneNode(true) as Element;
  for (const extra of copy.querySelectorAll(NOT_LINE_TEXT_SELECTOR)) {
    extra.remove();
  }
  return copy.textContent;
}

/** The line cell of a diff row, or null for a row that is not a line of code. */
function lineCellOf(row: Element | null): HTMLElement | null {
  return row?.querySelector<HTMLElement>(`:scope > ${LINE_CELL_SELECTOR}`) ?? null;
}

/** The side and line a line cell stands for. An added or unchanged line is on the right. */
function sideAndLineOf(cell: HTMLElement): Pick<LineAnchor, "line" | "side"> | null {
  const newLine = Number(cell.dataset.mline);
  const oldLine = Number(cell.dataset.oline);
  if (Number.isInteger(newLine) && newLine > 0) {
    return { line: newLine, side: "right" };
  }
  return Number.isInteger(oldLine) && oldLine > 0 ? { line: oldLine, side: "left" } : null;
}

function filePathOf(element: Element): string | null {
  const path = element
    .closest(FILE_CARD_SELECTOR)
    ?.querySelector(FILE_PATH_SELECTOR)
    ?.textContent.trim();
  return path === undefined || path === "" ? null : path;
}

/** The line row a box in the diff belongs to: the nearest row above it that is a line of code. */
function lineRowAbove(boxRow: Element): Element | null {
  let row = boxRow.previousElementSibling;
  while (row !== null && lineCellOf(row) === null) {
    row = row.previousElementSibling;
  }
  return row;
}

function lineAnchorOf(boxRow: Element): BoxAnchor | null {
  const cell = lineCellOf(lineRowAbove(boxRow));
  const filePath = filePathOf(boxRow);
  const sideAndLine = cell === null ? null : sideAndLineOf(cell);
  if (cell === null || filePath === null || sideAndLine === null) {
    return null;
  }
  return { filePath, kind: "line", lineLength: lineTextOf(cell).length, ...sideAndLine };
}

/** A box in the single-file view's code editor. */
function editorBoxAnchorOf(box: Element): BoxAnchor | null {
  const anchor = editorAnchorOf(box);
  return anchor === null ? null : { kind: "line", ...anchor };
}

/** Null for a box whose place the script cannot read. */
function anchorOf(box: Element): BoxAnchor | null {
  const boxRow = box.closest(DIFF_ROW_SELECTOR);
  if (boxRow !== null) {
    return lineAnchorOf(boxRow);
  }
  if (box.closest(ZONE_SELECTOR) !== null) {
    return editorBoxAnchorOf(box);
  }
  return box.closest(OVERVIEW_BOX_SELECTOR) === null ? null : { kind: "general" };
}

function commentBoxOf(box: Element): CommentBox | null {
  const textarea = [...box.querySelectorAll("textarea")].find(
    (candidate) =>
      candidate.getAttribute("aria-hidden") !== "true" &&
      NEW_THREAD_CLASS.test(candidate.className),
  );
  const postButton = box.querySelector<HTMLButtonElement>("button.bolt-button.primary");
  const anchor = anchorOf(box);
  if (textarea === undefined || postButton === null || anchor === null) {
    return null;
  }
  const cancelButton =
    postButton.parentElement?.querySelector<HTMLButtonElement>(
      ":scope > button.bolt-button:not(.primary)",
    ) ?? null;
  return { anchor, cancelButton, postButton, textarea };
}

/** Every open comment box for a new thread whose place the script can read. */
function findCommentBoxes(document: Document): CommentBox[] {
  return [...document.querySelectorAll(BOX_SELECTOR)].flatMap((box) => commentBoxOf(box) ?? []);
}

/** The row of this line in the all-files view, or null when it is not on the page. */
function findLineRow(
  document: Document,
  { filePath, line, side }: Pick<LineAnchor, "filePath" | "line" | "side">,
): Element | null {
  for (const card of document.querySelectorAll(FILE_CARD_SELECTOR)) {
    if (filePathOf(card) === filePath) {
      const attribute = side === "right" ? "data-mline" : "data-oline";
      const cells = [
        ...card.querySelectorAll<HTMLElement>(`${LINE_CELL_SELECTOR}[${attribute}="${line}"]`),
      ];
      const cell = cells.find((candidate) => sideAndLineOf(candidate)?.side === side);
      return cell?.closest(DIFF_ROW_SELECTOR) ?? null;
    }
  }
  return null;
}

export type { BoxAnchor, CommentBox };
export { BOX_SELECTOR, commentBoxOf, findCommentBoxes, findLineRow };
