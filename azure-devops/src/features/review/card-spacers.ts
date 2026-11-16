// In the side-by-side layout a pending card makes its pane taller. A spacer of the
// card's height in the other pane keeps the lines of both panes next to each other.
import { CARD_ROW_CLASS } from "./pending-cards.ts";
import { ID_ATTRIBUTE } from "./pending-card.ts";
import { element } from "./review-markup.ts";

const SPACER_ROW_CLASS = "fix-ado-review-spacer-row";
const SPLIT_SELECTOR = ".repos-summary-diff-splitter";
const PANE_SELECTOR = ".repos-summary-diff-blocks";
/** The spacer's height, read by the stylesheet. */
const HEIGHT_PROPERTY = "--fix-ado-review-spacer-height";
/** Rows this close in height or position count as equal. */
const PIXEL_TOLERANCE = 0.5;

function otherPaneOf(cardRow: Element): Element | null {
  const ownPane = cardRow.closest(PANE_SELECTOR);
  const panes = [...(cardRow.closest(SPLIT_SELECTOR)?.querySelectorAll(PANE_SELECTOR) ?? [])];
  return panes.find((pane) => pane !== ownPane) ?? null;
}

/** The last row of the other pane that starts above the card: the spacer goes after it. */
function rowBeside(cardRow: Element, otherPane: Element): Element | null {
  const { top } = cardRow.getBoundingClientRect();
  let beside: Element | null = null;
  for (const row of otherPane.children) {
    if (beside === null || row.getBoundingClientRect().top < top - PIXEL_TOLERANCE) {
      beside = row;
    }
  }
  return beside;
}

function insertSpacer(cardRow: Element, id: string): HTMLElement | null {
  const otherPane = otherPaneOf(cardRow);
  const beside = otherPane === null ? null : rowBeside(cardRow, otherPane);
  if (beside === null) {
    return null;
  }
  const document = cardRow.ownerDocument;
  const spacer = element(document, "div", {
    className: `repos-diff-contents-row ${SPACER_ROW_CLASS}`,
  });
  spacer.setAttribute(ID_ATTRIBUTE, id);
  spacer.append(element(document, "div"));
  beside.after(spacer);
  return spacer;
}

/** Makes the spacer as tall as its card. Only writes a new height, so the page settles. */
function matchHeight(spacer: HTMLElement, cardRow: Element): void {
  const { height } = cardRow.getBoundingClientRect();
  const shown = Number(spacer.dataset.fixAdoReviewHeight ?? 0);
  if (Math.abs(shown - height) > PIXEL_TOLERANCE) {
    spacer.dataset.fixAdoReviewHeight = String(height);
    spacer.style.setProperty(HEIGHT_PROPERTY, `${height}px`);
  }
}

/** Gives every card in a side-by-side diff a spacer in the other pane, and removes the others. */
function syncCardSpacers(document: Document): void {
  const stale = new Set(document.querySelectorAll<HTMLElement>(`.${SPACER_ROW_CLASS}`));
  for (const cardRow of document.querySelectorAll(`${SPLIT_SELECTOR} .${CARD_ROW_CLASS}`)) {
    const id = cardRow.getAttribute(ID_ATTRIBUTE) ?? "";
    const spacer =
      [...stale].find((row) => row.getAttribute(ID_ATTRIBUTE) === id) ?? insertSpacer(cardRow, id);
    if (spacer !== null) {
      stale.delete(spacer);
      matchHeight(spacer, cardRow);
    }
  }
  for (const spacer of stale) {
    spacer.remove();
  }
}

export { syncCardSpacers };
