// Keeps the file tree where it is while the script adds or removes pending rows. The
// tree draws only the rows near the part in view, and picks them from how far it is
// scrolled. A pending row is the script's own: when one comes or goes above the part
// in view, everything under it moves. The script shifts the whole tree back by as
// much in the same moment, so the owner sees no jump. It does not scroll the tree for
// this: the tree would pick other rows, and the pending row would come and go forever.
// The shift then wears off while the owner scrolls, a little per scrolled pixel: a
// large shift would move the rows the tree draws out of view.

/** How far the tree is shifted now, and where it was scrolled when the shift last wore off. */
interface TreeShift {
  /** Pixels the tree sits lower than it would by itself. Negative for higher. */
  pixels: number;
  scrollTop: number;
}

const TREE_SELECTOR = ".repos-changes-explorer-tree";
/** A row of Azure DevOps's own. The script's pending rows have no place in the tree's numbering. */
const TREE_ROW_SELECTOR = `${TREE_SELECTOR} tr.bolt-tree-row[aria-rowindex]`;
/** The element the tree scrolls in. */
const SCROLLER_SELECTOR = ".v-scroll-auto";
/** A move smaller than this is not corrected. */
const SMALLEST_MOVE = 1;
/** The tree is never shifted further than this: beyond it, the rows in view jump instead. */
const LARGEST_SHIFT = 100;
/** The part of each scrolled pixel the shift wears off by. */
const WEAR_PER_SCROLLED_PIXEL = 0.25;

const shiftByScroller = new WeakMap<Element, TreeShift>();

/** Shifts the tree. Never further up than it is scrolled down, or its first rows would be out of reach. */
function shiftTree(scroller: Element, shift: TreeShift, pixels: number): void {
  const limited = Math.min(Math.max(pixels, -LARGEST_SHIFT, -scroller.scrollTop), LARGEST_SHIFT);
  shift.pixels = Math.round(limited);
  shift.scrollTop = scroller.scrollTop;
  const tree = scroller.querySelector<HTMLElement>(TREE_SELECTOR);
  const margin = shift.pixels === 0 ? "" : `${shift.pixels}px`;
  if (tree !== null && tree.style.marginTop !== margin) {
    tree.style.marginTop = margin;
  }
}

/** Wears the shift off by how far the owner scrolled since it last did. */
function wearOff(scroller: Element, shift: TreeShift): void {
  const wear = Math.abs(scroller.scrollTop - shift.scrollTop) * WEAR_PER_SCROLLED_PIXEL;
  const left = Math.max(Math.abs(shift.pixels) - wear, 0);
  shiftTree(scroller, shift, Math.sign(shift.pixels) * left);
}

/** The shift of the tree in this scroller. The first call starts wearing it off on every scroll. */
function shiftOf(scroller: Element): TreeShift {
  const known = shiftByScroller.get(scroller);
  if (known !== undefined) {
    return known;
  }
  const shift = { pixels: 0, scrollTop: scroller.scrollTop };
  shiftByScroller.set(scroller, shift);
  scroller.addEventListener(
    "scroll",
    () => {
      wearOff(scroller, shift);
    },
    { passive: true },
  );
  return shift;
}

/** The first of the tree's own rows that starts in the part in view, with the element the tree scrolls in. */
function firstRowInView(document: Document): { row: Element; scroller: Element } | null {
  const scroller = document.querySelector(TREE_SELECTOR)?.closest(SCROLLER_SELECTOR) ?? null;
  if (scroller === null) {
    return null;
  }
  const viewTop = scroller.getBoundingClientRect().top;
  const row = [...document.querySelectorAll(TREE_ROW_SELECTOR)].find(
    (candidate) => candidate.getBoundingClientRect().top >= viewTop,
  );
  return row === undefined ? null : { row, scroller };
}

/** Runs a change to the tree's rows, then shifts the tree so the rows in view stay where they were. */
function keepingTreeInPlace(document: Document, change: () => void): void {
  const anchor = firstRowInView(document);
  const topBefore = anchor?.row.getBoundingClientRect().top ?? 0;
  change();
  const moved = (anchor?.row.getBoundingClientRect().top ?? 0) - topBefore;
  if (anchor !== null && Math.abs(moved) >= SMALLEST_MOVE) {
    const shift = shiftOf(anchor.scroller);
    shiftTree(anchor.scroller, shift, shift.pixels - moved);
  }
}

export { keepingTreeInPlace };
