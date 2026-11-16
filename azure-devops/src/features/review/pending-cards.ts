// The cards of the pending comments in the all-files view: one under the line each
// comment is on, marked "Pending". Only the owner sees them.
import {
  ID_ATTRIBUTE,
  ONLY_YOU_NOTE,
  createCard,
  holdsCurrent,
  markHolder,
} from "./pending-card.ts";
import type { ShownComment } from "./pending-card.ts";
import { element } from "./review-markup.ts";
import { findLineRow } from "./comment-boxes.ts";

const CARD_ROW_CLASS = "fix-ado-review-card-row";
/** The cell Azure DevOps puts a thread or a comment box in. */
const THREAD_SELECTOR = ".repos-diff-discussion";
const LINE_CELL_CLASS = "repos-line-content";

/** A cell like the one Azure DevOps puts a thread in, so the card sits under the code. */
function cardCell(document: Document, comment: ShownComment): HTMLElement {
  const cell = element(document, "div", { className: "fix-ado-review-card-cell body-m" });
  cell.append(createCard(document, comment, ONLY_YOU_NOTE));
  return cell;
}

/** The cells before the code in a line's row: one line number fewer in the side-by-side layout. */
function cellsBeforeCode(lineRow: Element): number {
  return [...lineRow.children].findIndex((cell) => cell.classList.contains(LINE_CELL_CLASS));
}

function createCardRow(lineRow: Element, comment: ShownComment): HTMLElement {
  const document = lineRow.ownerDocument;
  const row = element(document, "div", { className: `repos-diff-contents-row ${CARD_ROW_CLASS}` });
  markHolder(row, comment);
  for (let cell = 0; cell < cellsBeforeCode(lineRow); cell += 1) {
    row.append(element(document, "span"));
  }
  row.append(cardCell(document, comment));
  return row;
}

/** True for a row with a thread or a comment box of Azure DevOps's own. */
function isThreadRow(row: Element | null): boolean {
  return row?.querySelector(`:scope > ${THREAD_SELECTOR}`) !== null && row !== null;
}

function isCardRow(row: Element | null): boolean {
  return row?.classList.contains(CARD_ROW_CLASS) === true;
}

/** True when the card sits under this line, below the line's threads. */
function isInPlace(cardRow: Element, lineRow: Element): boolean {
  let above = cardRow.previousElementSibling;
  while (isCardRow(above) || isThreadRow(above)) {
    above = above?.previousElementSibling ?? null;
  }
  let below = cardRow.nextElementSibling;
  while (isCardRow(below)) {
    below = below?.nextElementSibling ?? null;
  }
  return above === lineRow && !isThreadRow(below);
}

/**
 * The last row under a line: its threads, then its cards. A new card goes after it,
 * so the cards follow the posted threads, in the order written.
 */
function lastRowUnder(lineRow: Element): Element {
  let last = lineRow;
  while (isCardRow(last.nextElementSibling) || isThreadRow(last.nextElementSibling)) {
    last = last.nextElementSibling ?? last;
  }
  return last;
}

/** Shows a card under the line of every pending comment on the page, and removes the others. */
function syncPendingCards(document: Document, pending: ShownComment[]): void {
  const stale = new Set(document.querySelectorAll<HTMLElement>(`.${CARD_ROW_CLASS}`));
  for (const comment of pending) {
    const lineRow = comment.anchor === null ? null : findLineRow(document, comment.anchor);
    const cardRow = [...stale].find((row) => row.getAttribute(ID_ATTRIBUTE) === comment.id);
    const isUpToDate =
      lineRow !== null &&
      cardRow !== undefined &&
      isInPlace(cardRow, lineRow) &&
      holdsCurrent(cardRow, comment);
    if (cardRow !== undefined && isUpToDate) {
      stale.delete(cardRow);
    } else if (lineRow !== null) {
      lastRowUnder(lineRow).after(createCardRow(lineRow, comment));
    }
  }
  for (const cardRow of stale) {
    cardRow.remove();
  }
}

export { CARD_ROW_CLASS, syncPendingCards };
