// The pending comments in the file tree of the Files tab: one row under its file,
// after the file's posted threads, as Azure DevOps lists a thread there. A dot in
// the "Pending" colour stands where a thread has its author's picture.
import {
  THREAD_ITEM_CLASS,
  drawnRowOf,
  isThreadRow,
  treeNow,
} from "../../pull-requests/file-tree/tree-rows.ts";
import type { ChangedPaths } from "../../pull-requests/file-tree/tree-rows.ts";
import type { ShownComment } from "./pending-card.ts";
import { element } from "./review-markup.ts";
import { keepingTreeInPlace } from "./tree-scroll-anchor.ts";

const PENDING_ROW_CLASS = "fix-ado-review-tree-row";
const ID_ATTRIBUTE = "data-fix-ado-review-tree-id";
const INDENT_SELECTOR = ".bolt-tree-expand-button";
/** How far a row sits right of its parent, in pixels. */
const INDENT_STEP = 16;
const DOT_TITLE = "Pending comment";
/** In front of a comment with unsaved text, as in a thread's row. */
const UNSAVED_MARK = "*";

function cell(document: Document, className: string): HTMLElement {
  return element(document, "td", { className: `${className} bolt-table-cell bolt-list-cell` });
}

/** An indent one step deeper than the file's own, as a thread's row has. */
function threadIndent(fileRow: Element): HTMLElement {
  const indent = element(fileRow.ownerDocument, "span", {
    className: "fix-ado-review-tree-indent",
  });
  const fileIndent = fileRow.querySelector<HTMLElement>(INDENT_SELECTOR)?.style.marginLeft ?? "";
  const pixels = fileIndent.endsWith("px") ? Number(fileIndent.slice(0, -"px".length)) : 0;
  indent.style.marginLeft = `${pixels + INDENT_STEP}px`;
  return indent;
}

function pendingDot(document: Document): HTMLElement {
  const dot = element(document, "span", { className: "fix-ado-review-pending-dot" });
  dot.title = DOT_TITLE;
  dot.setAttribute("aria-label", DOT_TITLE);
  dot.setAttribute("role", "img");
  return dot;
}

/** The comment's first line. An unsaved edit shows instead, after a star, as Azure DevOps marks its own. */
function pendingText(document: Document, { content, draft }: ShownComment): HTMLElement {
  const [firstLine = ""] = (draft ?? content).split("\n");
  const text = element(document, "div", { className: "flex-grow text-ellipsis" });
  if (draft !== null) {
    text.append(element(document, "span", { className: "margin-right-4", text: UNSAVED_MARK }));
  }
  text.append(firstLine);
  return text;
}

/** The row's content: the indent, the dot, and the comment's text. */
function pendingItem(fileRow: Element, comment: ShownComment): HTMLElement {
  const document = fileRow.ownerDocument;
  const item = element(document, "div", {
    className: `${THREAD_ITEM_CLASS} rhythm-horizontal-4 bolt-table-cell-content flex-row flex-center`,
  });
  item.append(threadIndent(fileRow), pendingDot(document), pendingText(document, comment));
  return item;
}

/** What a row shows of a comment, to tell when it must be drawn again. */
function shownOf({ content, draft }: ShownComment): string {
  return JSON.stringify([content, draft]);
}

/** The file row a pending row belongs to: the nearest row above it that is not a thread's. */
function fileRowAbove(pendingRow: Element): Element | null {
  let above = pendingRow.previousElementSibling;
  while (isThreadRow(above)) {
    above = above?.previousElementSibling ?? null;
  }
  return above;
}

/** Clicks the file's own row, which opens the file. */
function openFileOf(pendingRow: HTMLElement): void {
  const fileRow = fileRowAbove(pendingRow);
  const view = pendingRow.ownerDocument.defaultView;
  if (fileRow !== null && view !== null) {
    fileRow.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
  }
}

function createPendingRow(fileRow: Element, comment: ShownComment): HTMLElement {
  const document = fileRow.ownerDocument;
  const row = element(document, "tr", {
    className: `bolt-tree-row bolt-table-row bolt-list-row single-click-activation ${PENDING_ROW_CLASS}`,
  });
  row.setAttribute(ID_ATTRIBUTE, comment.id);
  row.dataset.fixAdoReviewShown = shownOf(comment);
  const treeCell = cell(document, "bolt-tree-cell");
  treeCell.append(pendingItem(fileRow, comment));
  row.append(cell(document, "bolt-table-cell-compact"), cell(document, ""), treeCell);
  // A click opens the file, as a click on the file's own row does.
  row.addEventListener("click", () => {
    openFileOf(row);
  });
  return row;
}

/** The last thread row under a file's row, or the file's row: a new row goes after it. */
function lastRowUnder(fileRow: Element): Element {
  let last = fileRow;
  while (isThreadRow(last.nextElementSibling)) {
    last = last.nextElementSibling ?? last;
  }
  return last;
}

/** What the tree should show: the pending comments, and the files the pull request changes. */
interface TreeReview {
  pending: ShownComment[];
  changedPaths: ChangedPaths;
}

/** True when the row shows this comment under this file's row. */
function isUpToDate(row: HTMLElement, fileRow: Element | null, comment: ShownComment): boolean {
  return row.dataset.fixAdoReviewShown === shownOf(comment) && fileRowAbove(row) === fileRow;
}

/** Shows a comment's row under its file's row, unless it is there already. A row that stays leaves `stale`. */
function showRow(stale: Set<HTMLElement>, fileRow: Element | null, comment: ShownComment): void {
  const row = [...stale].find((candidate) => candidate.getAttribute(ID_ATTRIBUTE) === comment.id);
  if (row !== undefined && isUpToDate(row, fileRow, comment)) {
    stale.delete(row);
  } else if (fileRow !== null) {
    lastRowUnder(fileRow).after(createPendingRow(fileRow, comment));
  }
}

/**
 * Shows a row under its file for every pending comment on a line, and removes the
 * others. The rows in view stay where they are.
 */
function syncTreePendingRows(document: Document, { changedPaths, pending }: TreeReview): void {
  const stale = new Set(document.querySelectorAll<HTMLElement>(`.${PENDING_ROW_CLASS}`));
  const tree = treeNow(document, changedPaths);
  keepingTreeInPlace(document, () => {
    for (const comment of pending.filter(({ anchor }) => anchor !== null)) {
      showRow(stale, drawnRowOf(comment.anchor?.filePath ?? "", tree), comment);
    }
    for (const row of stale) {
      row.remove();
    }
  });
}

export { syncTreePendingRows };
