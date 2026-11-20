// Reaches rows of the file tree that it does not draw. The tree draws only the rows
// near the part in view, so the script scrolls it, hidden, until the row it needs is
// drawn, and scrolls it back after.
import { drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import type { ChangedPaths } from "../../pull-requests/file-tree/tree-rows.ts";

const TREE_SELECTOR = ".repos-changes-explorer-tree";
/** The element the tree scrolls in. */
const SCROLLER_SELECTOR = ".v-scroll-auto";
/** The part of the view each step scrolls by, so a step keeps the row above it in view. */
const STEP_OF_VIEW = 0.8;

interface TreeWalk {
  document: Document;
  changedPaths: ChangedPaths;
  /** How long to wait for the tree to draw after a scroll or a click. */
  drawTimeoutMs: number;
}

function scrollerOf(document: Document): HTMLElement | null {
  return document.querySelector(TREE_SELECTOR)?.closest<HTMLElement>(SCROLLER_SELECTOR) ?? null;
}

/** Waits until the tree draws rows or changes a tick or fold, or the time is up. */
async function nextTreeDraw({ document, drawTimeoutMs }: TreeWalk): Promise<void> {
  const scroller = scrollerOf(document);
  const view = document.defaultView;
  if (scroller === null || view === null) {
    return;
  }
  await new Promise<void>((resolve) => {
    const observer = new view.MutationObserver(() => {
      done();
    });
    const timer = view.setTimeout(done, drawTimeoutMs);
    function done(): void {
      observer.disconnect();
      view?.clearTimeout(timer);
      resolve();
    }
    observer.observe(scroller, {
      attributeFilter: ["aria-checked", "aria-expanded"],
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Runs `walk` with the tree hidden, then scrolls the tree back to where it was and
 * shows it again.
 */
async function keepingScroll(walk: TreeWalk, run: () => Promise<void>): Promise<void> {
  const scroller = scrollerOf(walk.document);
  if (scroller === null) {
    return;
  }
  const top = scroller.scrollTop;
  try {
    await run();
  } finally {
    if (scroller.scrollTop !== top) {
      scroller.scrollTop = top;
      await nextTreeDraw(walk);
    }
    scroller.style.visibility = "";
  }
}

/** Scrolls the tree to `top` and waits for it to draw there. */
async function scrollTo(walk: TreeWalk, scroller: HTMLElement, top: number): Promise<void> {
  if (scroller.scrollTop !== top) {
    scroller.scrollTop = top;
    await nextTreeDraw(walk);
  }
}

/** True when the tree is scrolled to its end. */
function isAtEnd(scroller: HTMLElement): boolean {
  return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight;
}

/** Scrolls through the whole tree from the top and calls `visit` after each step, until it returns true. */
async function walkFromTop(
  walk: TreeWalk,
  scroller: HTMLElement,
  visit: () => boolean,
): Promise<boolean> {
  let top = 0;
  let isFound = false;
  while (!isFound && (top === 0 || !isAtEnd(scroller))) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each step waits for the tree to draw there
    await scrollTo(walk, scroller, top);
    isFound = visit();
    top = scroller.scrollTop + Math.max(Math.floor(scroller.clientHeight * STEP_OF_VIEW), 1);
  }
  return isFound;
}

/**
 * Calls `visit` on the rows drawn now, then scrolls through the whole tree from the
 * top, hidden, and calls it after each step, until it returns true. Call it inside
 * `keepingScroll`. Returns true when `visit` did.
 */
async function walkTree(walk: TreeWalk, visit: () => boolean): Promise<boolean> {
  const scroller = scrollerOf(walk.document);
  if (scroller === null || visit()) {
    return scroller !== null;
  }
  scroller.style.visibility = "hidden";
  return walkFromTop(walk, scroller, visit);
}

/** Scrolls the tree until it draws the row of `path`, then runs `act` on it. False when no row has that path. */
async function withDrawnRow(
  walk: TreeWalk,
  path: string,
  act: (row: Element) => Promise<void>,
): Promise<boolean> {
  const found: { row: Element | null } = { row: null };
  await walkTree(walk, () => {
    found.row = drawnRowOf(path, treeNow(walk.document, walk.changedPaths));
    return found.row !== null;
  });
  if (found.row !== null) {
    await act(found.row);
  }
  return found.row !== null;
}

export { keepingScroll, nextTreeDraw, walkTree, withDrawnRow };
export type { TreeWalk };
