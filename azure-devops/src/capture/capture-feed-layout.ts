// How tall the rows of a pull request's activity feed are drawn: each row with the heights
// of the boxes inside it, and whether Azure DevOps set a height on it. They show which box
// keeps its height when a folded push leaves a gap. Kinds and pixels, never content. Dev file only.

interface FeedLayout {
  /**
   * Each row of the feed, in order, as "kind:row:cell:timeline:content:card:set or auto".
   * The numbers are heights. "set" is a row or cell with a height in its style.
   */
  rows: string[];
}

const FEED_SELECTOR = ".activity-feed-list";
const BOX_SELECTORS = [
  ":scope > td",
  ".bolt-timeline-sequence",
  ".bolt-timeline-cell-content",
  ".bolt-card",
];

function kindOf(row: HTMLElement): string {
  if (row.classList.contains("bolt-list-row-spacer")) {
    return "spacer";
  }
  const state = row.querySelector<HTMLElement>("[data-fix-ado-push]")?.dataset.fixAdoPush;
  return state === undefined ? "row" : `push-${state}`;
}

const heightOf = (box: Element | null): number =>
  Math.round(box?.getBoundingClientRect().height ?? 0);

function isHeightSet(row: HTMLElement): boolean {
  const cell = row.querySelector<HTMLElement>(":scope > td");
  return row.style.height !== "" || (cell !== null && cell.style.height !== "");
}

/** The layout of the activity feed, or null on a page without one. */
function feedLayoutOf(document: Document): FeedLayout | null {
  const feed = document.querySelector(FEED_SELECTOR);
  if (feed === null) {
    return null;
  }
  const rows = [...feed.querySelectorAll<HTMLElement>(":scope > tbody > tr")].map((row) => {
    const heights = [row, ...BOX_SELECTORS.map((selector) => row.querySelector(selector))].map(
      (box) => heightOf(box),
    );
    return [kindOf(row), ...heights, isHeightSet(row) ? "set" : "auto"].join(":");
  });
  return { rows };
}

export { feedLayoutOf };
