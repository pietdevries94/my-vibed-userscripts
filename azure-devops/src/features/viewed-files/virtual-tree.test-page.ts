// A Files tab with a file tree that draws only the rows in view, as Azure DevOps's
// does, and a card per file. A folder is ticked when all its files are; ticking a
// folder ticks every file in it. Test code only.
import { JSDOM } from "jsdom";
import { listedRows } from "../../pull-requests/file-tree/tree-listing.ts";

const ROW_HEIGHT = 20;
const ROW_MARKUP = `<td><div class="bolt-checkbox" role="checkbox"></div></td><td class="bolt-tree-cell"><span class="bolt-tree-expand-button"></span><span class="text-ellipsis"><span></span></span></td>`;
const CARD_MARKUP = `<div class="flex-row"><button class="bolt-card-expand-button" aria-expanded="true"></button><div class="flex-row flex-grow"><div class="flex-column"><div role="heading"><span class="text-ellipsis"></span></div><div class="body-s secondary-text text-ellipsis"></div></div><div class="flex-row flex-grow justify-end"><a class="bolt-link-button">View</a></div></div></div>`;
const PAGE_MARKUP = `<!doctype html><body><div class="v-scroll-auto"><table class="repos-changes-explorer-tree"><tbody></tbody></table></div><div class="repos-changes-viewer"></div></body>`;
const BAR_MARKUP = `<div class="secondary-text text-ellipsis"></div><div class="bolt-split-button"></div>`;

interface VirtualTreeOptions {
  changedPaths: string[];
  /** How many rows fit in view. */
  rowsInView: number;
  ticked?: string[];
  /** How long the tree takes to show a tick after a click, as when it saves the tick first. */
  tickDelayMs?: number;
  /** How long the tree takes to draw after a scroll or a fold. */
  drawDelayMs?: number;
  /** The tree draws rows in pages of this many: a scroll within a page draws nothing new. */
  pageRows?: number;
  /** The file open on the right; without one, the folder view with a card per file. */
  openFile?: string;
  /** How far short of the end the scroll stops, as in a browser at a zoom, where `scrollTop` is fractional. */
  scrollStopsShortPx?: number;
}

interface VirtualTree {
  document: Document;
  scroller: HTMLElement;
  /** True when the tree's own state has the row ticked. */
  isTicked: (path: string) => boolean;
  isFolded: (path: string) => boolean;
  /** Ticks or unticks a row as a click on its checkbox does. */
  clickTick: (path: string) => void;
  /** Shows another file in the bar, changing its text in place as React does. */
  showFileInBar: (path: string) => void;
  /** Waits until the tree drew what its last change asks for. */
  settled: () => Promise<void>;
  /** How often the script set the tree's scroll position. */
  scrollWrites: () => number;
}

/** The fake tree's own state. */
interface FakeTree {
  document: Document;
  body: Element;
  changedPaths: string[];
  rowsInView: number;
  tickedFiles: Set<string>;
  folded: Set<string>;
  top: number;
  drawn: Promise<void>;
  tickDelayMs: number;
  drawDelayMs: number;
  pageRows: number;
  scrollStopsShortPx: number;
  scrollWrites: number;
  /** What the drawn rows show, to leave the DOM alone when nothing changed, as React does. */
  drawnKey: string;
}

type ListedRow = ReturnType<typeof listedRows>[number];

function filesUnder(tree: FakeTree, path: string): string[] {
  return tree.changedPaths.includes(path)
    ? [path]
    : tree.changedPaths.filter((file) => file.startsWith(`${path}/`));
}

function isTicked(tree: FakeTree, path: string): boolean {
  return filesUnder(tree, path).every((file) => tree.tickedFiles.has(file));
}

/** The rows the tree lists now: none under a folded folder. */
function shownRows(tree: FakeTree): ListedRow[] {
  return listedRows(tree.changedPaths).filter(
    ({ path }) => ![...tree.folded].some((folder) => path.startsWith(`${folder}/`)),
  );
}

/** The place of the first drawn row, and the rows drawn: whole pages over the part in view. */
function pagesInView(tree: FakeTree): { first: number; rows: ListedRow[] } {
  const firstInView = Math.floor(tree.top / ROW_HEIGHT);
  const lastInView = Math.ceil((tree.top + tree.rowsInView * ROW_HEIGHT) / ROW_HEIGHT) - 1;
  const first = Math.floor(firstInView / tree.pageRows) * tree.pageRows;
  const end = (Math.floor(lastInView / tree.pageRows) + 1) * tree.pageRows;
  return { first, rows: shownRows(tree).slice(first, end) };
}

function draw(tree: FakeTree): void {
  const { first, rows } = pagesInView(tree);
  const key = rows
    .map(({ path }) => `${path}:${String(isTicked(tree, path))}:${String(tree.folded.has(path))}`)
    .join("|");
  if (key === tree.drawnKey) {
    return;
  }
  tree.drawnKey = key;
  // oxlint-disable-next-line typescript/no-use-before-define -- a row's clicks draw the tree again
  tree.body.replaceChildren(...rows.map((row, offset) => treeRow(tree, row, first + offset)));
}

/** Gives an element a place on screen, as layout would: `top` is read on each call. */
function placeAt(element: Element, top: () => number, height: () => number): void {
  element.getBoundingClientRect = (): DOMRect => {
    const at = top();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the walk reads only top and bottom
    return { bottom: at + height(), top: at } as DOMRect;
  };
}

/** Draws in a later task, as Azure DevOps does after a scroll or a click. */
function drawSoon(tree: FakeTree, delayMs = 0): void {
  const view = tree.document.defaultView;
  tree.drawn = new Promise((resolve) => {
    view?.setTimeout(() => {
      draw(tree);
      resolve();
    }, delayMs);
  });
}

function clickTick(tree: FakeTree, path: string): void {
  const tick = !isTicked(tree, path);
  for (const file of filesUnder(tree, path)) {
    if (tick) {
      tree.tickedFiles.add(file);
    } else {
      tree.tickedFiles.delete(file);
    }
  }
  drawSoon(tree, Math.max(tree.tickDelayMs, tree.drawDelayMs));
}

function clickFold(tree: FakeTree, path: string): void {
  if (tree.folded.has(path)) {
    tree.folded.delete(path);
  } else {
    tree.folded.add(path);
  }
  drawSoon(tree, tree.drawDelayMs);
}

function treeRow(tree: FakeTree, { level, name, path }: ListedRow, index: number): HTMLElement {
  const row = tree.document.createElement("tr");
  row.className = "bolt-tree-row";
  row.innerHTML = ROW_MARKUP;
  row.setAttribute("aria-level", String(level));
  row.setAttribute("aria-rowindex", String(index + 1));
  if (!tree.changedPaths.includes(path)) {
    row.setAttribute("aria-expanded", String(!tree.folded.has(path)));
  }
  const tick = row.querySelector(".bolt-checkbox");
  tick?.setAttribute("aria-checked", String(isTicked(tree, path)));
  tick?.addEventListener("click", () => {
    clickTick(tree, path);
  });
  row.querySelector(".bolt-tree-expand-button")?.addEventListener("click", () => {
    clickFold(tree, path);
  });
  row.querySelector(".text-ellipsis span")?.append(name);
  placeAt(
    row,
    () => index * ROW_HEIGHT - tree.top,
    () => ROW_HEIGHT,
  );
  return row;
}

function card(document: Document, path: string): HTMLElement {
  const header = document.createElement("div");
  header.className = "repos-summary-header bolt-card";
  header.innerHTML = CARD_MARKUP;
  header.querySelector("[role=heading] .text-ellipsis")?.append(path.split("/").at(-1) ?? "");
  header.querySelector(".secondary-text")?.append(path);
  const expand = header.querySelector<HTMLElement>(".bolt-card-expand-button");
  expand?.addEventListener("click", () => {
    expand.setAttribute("aria-expanded", String(expand.getAttribute("aria-expanded") !== "true"));
  });
  return header;
}

/** The bar above the single-file view, for the file at `path`. */
function fileBar(document: Document, path: string): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "repos-compare-toolbar";
  bar.innerHTML = BAR_MARKUP;
  bar.querySelector(".secondary-text")?.append(path);
  return bar;
}

/** Fills the right pane: a card per file, or the bar of the open file. */
function fillViewer(document: Document, changedPaths: string[], openFile?: string): void {
  const viewer = document.querySelector(".repos-changes-viewer");
  if (openFile === undefined) {
    viewer?.classList.add("is-folder");
    viewer?.append(...changedPaths.map((path) => card(document, path)));
  } else {
    viewer?.before(fileBar(document, openFile));
  }
}

/** More scroll writes than any walk of a test tree needs: the script is stuck. */
const MAX_SCROLL_WRITES = 1000;

/** Makes the scroller scroll as a browser's does: it stops where the rows end, and the tree draws after. */
function scrollLikeABrowser(scroller: HTMLElement, tree: FakeTree): void {
  const end = (): number => shownRows(tree).length * ROW_HEIGHT;
  placeAt(
    scroller,
    () => 0,
    () => tree.rowsInView * ROW_HEIGHT,
  );
  placeAt(tree.body.closest("table") ?? tree.body, () => -tree.top, end);
  Object.defineProperties(scroller, {
    clientHeight: { get: () => tree.rowsInView * ROW_HEIGHT },
    scrollHeight: { get: end },
    scrollTop: {
      get: () => tree.top,
      set(value: number) {
        tree.scrollWrites += 1;
        if (tree.scrollWrites > MAX_SCROLL_WRITES) {
          throw new Error("the script keeps scrolling the tree");
        }
        const lastTop = end() - tree.rowsInView * ROW_HEIGHT - tree.scrollStopsShortPx;
        tree.top = Math.max(0, Math.min(value, lastTop));
        drawSoon(tree, tree.drawDelayMs);
      },
    },
  });
}

/** Shows another file in the bar, changing its text in place as React does. */
function showFileInBar(document: Document, path: string): void {
  const text = document.querySelector(".repos-compare-toolbar .secondary-text")?.firstChild;
  if (text !== null && text !== undefined) {
    text.nodeValue = path;
  }
}

function createVirtualTree({
  changedPaths,
  openFile,
  drawDelayMs = 0,
  pageRows = 1,
  rowsInView,
  scrollStopsShortPx = 0,
  tickDelayMs = 0,
  ticked = [],
}: VirtualTreeOptions): VirtualTree {
  const { document } = new JSDOM(PAGE_MARKUP).window;
  const scroller = document.querySelector<HTMLElement>(".v-scroll-auto");
  const body = document.querySelector("tbody");
  if (scroller === null || body === null) {
    throw new Error("the page has its tree");
  }
  fillViewer(document, changedPaths, openFile);
  const tree: FakeTree = {
    body,
    changedPaths,
    document,
    drawDelayMs,
    drawn: Promise.resolve(),
    drawnKey: "",
    folded: new Set(),
    pageRows,
    rowsInView,
    scrollStopsShortPx,
    scrollWrites: 0,
    tickDelayMs,
    tickedFiles: new Set(ticked),
    top: 0,
  };
  scrollLikeABrowser(scroller, tree);
  draw(tree);
  return {
    clickTick: (path) => {
      clickTick(tree, path);
    },
    document,
    isFolded: (path) => tree.folded.has(path),
    isTicked: (path) => isTicked(tree, path),
    scrollWrites: () => tree.scrollWrites,
    scroller,
    settled: async () => tree.drawn,
    showFileInBar: (path) => {
      showFileInBar(document, path);
    },
  };
}

export { createVirtualTree };
export type { VirtualTree };
