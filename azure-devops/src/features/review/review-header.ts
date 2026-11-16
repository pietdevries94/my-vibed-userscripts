// The review's place in the pull request's tab bar, which stays in view while the
// page scrolls: "Submit review" with the number of pending comments. On a pull request
// that is completed or abandoned it offers to copy or discard them instead.
import { actionButton, element, pendingCountText } from "./review-markup.ts";

const HEADER_CLASS = "fix-ado-review-header";
const TABBAR_SELECTOR = ".repos-pr-details-page-tabbar";

interface HeaderState {
  /** How many comments are pending. Zero shows no header. */
  count: number;
  /** False for a completed or abandoned pull request. */
  isPullRequestActive: boolean;
}

function submitButton(document: Document, count: number): HTMLElement {
  const button = actionButton(document, {
    action: "finish",
    isPrimary: true,
    text: "Submit review",
  });
  button.setAttribute("aria-label", `Submit review, ${pendingCountText(count)}`);
  button.append(
    element(document, "span", { className: "fix-ado-review-count", text: String(count) }),
  );
  return button;
}

function createHeader(
  document: Document,
  { count, isPullRequestActive }: HeaderState,
): HTMLElement {
  const header = element(document, "div", { className: HEADER_CLASS });
  if (isPullRequestActive) {
    header.append(submitButton(document, count));
  } else {
    header.append(
      element(document, "span", { className: "secondary-text", text: pendingCountText(count) }),
      actionButton(document, { action: "copy", text: "Copy" }),
      actionButton(document, { action: "discard", text: "Discard" }),
    );
  }
  return header;
}

/** Shows the header in the tab bar, rebuilt only when what it shows changes. */
function syncHeader(document: Document, state: HeaderState): void {
  const tabbar = state.count === 0 ? null : document.querySelector(TABBAR_SELECTOR);
  const existing = document.querySelector<HTMLElement>(`.${HEADER_CLASS}`);
  const shown = `${state.count} ${state.isPullRequestActive}`;
  if (tabbar === null) {
    existing?.remove();
  } else if (existing?.dataset.fixAdoReviewShown !== shown || existing.parentElement !== tabbar) {
    const header = createHeader(document, state);
    header.dataset.fixAdoReviewShown = shown;
    existing?.remove();
    tabbar.append(header);
  }
}

export { HEADER_CLASS, syncHeader };
