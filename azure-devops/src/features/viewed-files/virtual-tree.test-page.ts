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
  /** The file open on the right; without one, the folder view with a card per file. */
  openFile?: string;
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

function draw(tree: FakeTree): void {
  const first = Math.floor(tree.top / ROW_HEIGHT);
  const rows = shownRows(tree).slice(first, first + tree.rowsInView);
  // oxlint-disable-next-line typescript/no-use-before-define -- a row's clicks draw the tree again
  tree.body.replaceChildren(...rows.map((row, offset) => treeRow(tree, row, first + offset)));
}

/** Draws in a later task, as Azure DevOps does after a scroll or a click. */
function drawSoon(tree: FakeTree): void {
  const view = tree.document.defaultView;
  tree.drawn = new Promise((resolve) => {
    view?.setTimeout(() => {
      draw(tree);
      resolve();
    }, 0);
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
  drawSoon(tree);
}

function clickFold(tree: FakeTree, path: string): void {
  if (tree.folded.has(path)) {
    tree.folded.delete(path);
  } else {
    tree.folded.add(path);
  }
  drawSoon(tree);
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

/** Makes the scroller scroll as a browser's does: it stops where the rows end, and the tree draws after. */
function scrollLikeABrowser(scroller: HTMLElement, tree: FakeTree): void {
  const end = (): number => shownRows(tree).length * ROW_HEIGHT;
  Object.defineProperties(scroller, {
    clientHeight: { get: () => tree.rowsInView * ROW_HEIGHT },
    scrollHeight: { get: end },
    scrollTop: {
      get: () => tree.top,
      set(value: number) {
        tree.top = Math.max(0, Math.min(value, end() - tree.rowsInView * ROW_HEIGHT));
        drawSoon(tree);
      },
    },
  });
}

function createVirtualTree({
  changedPaths,
  openFile,
  rowsInView,
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
    drawn: Promise.resolve(),
    folded: new Set(),
    rowsInView,
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
    scroller,
    settled: async () => tree.drawn,
    showFileInBar: (path) => {
      const text = document.querySelector(".repos-compare-toolbar .secondary-text")?.firstChild;
      if (text !== null && text !== undefined) {
        text.nodeValue = path;
      }
    },
  };
}

export { createVirtualTree };
export type { VirtualTree };
