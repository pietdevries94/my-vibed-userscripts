// The star on each of Azure DevOps's reviewer rows on a pull request's Overview.
// Filled when that reviewer is starred. A click stars or unstars them.
import {
  STAR_BUTTON_CLASS,
  createStarButton,
  updateStarButton,
} from "./starred-reviewers-markup.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import type { StarredReviewersStore } from "./starred-reviewers-store.ts";
import { isNameOf } from "./starred-reviewers-store.ts";

/** Azure DevOps's reviewer sections. */
const REVIEWER_SECTION_SELECTOR =
  ".pr-required-reviewers-section, .pr-optional-reviewers-section, .pr-declined-reviewers-section";

/** Azure DevOps's reviewer rows, in its required, optional and declined sections. */
function reviewerRowsOf(document: Document): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const section of document.querySelectorAll(REVIEWER_SECTION_SELECTOR)) {
    rows.push(...section.querySelectorAll<HTMLElement>(":scope > .repos-reviewer"));
  }
  return rows;
}

function nameOfRow(row: Element): string {
  return row.querySelector(".flex-column > .body-m")?.textContent?.trim() ?? "";
}

/** True when Azure DevOps shows this identity as a reviewer. */
function isOnPage(document: Document, identity: Identity): boolean {
  return reviewerRowsOf(document).some((row) => isNameOf(identity, nameOfRow(row)));
}

/** Puts a star before the row's ⋮ button, or last when it has none. */
function insertStar(document: Document, row: HTMLElement, onClick: () => void): Element {
  const star = createStarButton(document);
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  const reveal = row.querySelector(":scope > .repos-reviewer-reveal");
  if (reveal === null) {
    row.append(star);
  } else {
    reveal.before(star);
  }
  return star;
}

/** Adds a star to each reviewer row that has none, and fills the stars of starred reviewers. */
function addStars(
  document: Document,
  store: StarredReviewersStore,
  onStarClick: (row: HTMLElement) => void,
): void {
  for (const row of reviewerRowsOf(document)) {
    const star =
      row.querySelector(`:scope > .${STAR_BUTTON_CLASS}`) ??
      insertStar(document, row, () => {
        onStarClick(row);
      });
    updateStarButton(star, store.findByName(nameOfRow(row)) !== null);
  }
}

export { addStars, isOnPage, nameOfRow };
