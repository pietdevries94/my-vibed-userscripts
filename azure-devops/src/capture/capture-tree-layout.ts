// Where the rows of the Files tab's file tree are drawn: the place and height of each
// row and spacer, and how far the tree is scrolled. The tree draws only the rows near
// the part in view, and the review feature adds rows and room of its own; these numbers
// show how the two fit together. Kinds, row numbers and pixels, never content. Dev file only.

interface TreeLayout {
  /** How far the tree is scrolled and how tall its view is, as "scrollTop:height". */
  view: string;
  /** Each row of the tree, in order, as "kind:row number:top:height". The top counts from the view's top. */
  rows: string[];
}

const TREE_SELECTOR = ".repos-changes-explorer-tree";
const SCROLLER_SELECTOR = ".v-scroll-auto";
const KINDS: [string, string][] = [
  ["fix-ado-review-tree-spacer", "own-spacer"],
  ["fix-ado-review-tree-row", "pending"],
  ["bolt-list-row-spacer", "tree-spacer"],
  ["repos-file-explorer-tree-thread-item", "thread"],
];

function kindOf(row: Element): string {
  const html = `${row.className} ${row.firstElementChild?.innerHTML ?? ""}`;
  return KINDS.find(([className]) => html.includes(className))?.[1] ?? "row";
}

/** The layout of the file tree, or null on a page without one. */
function treeLayoutOf(document: Document): TreeLayout | null {
  const tree = document.querySelector(TREE_SELECTOR);
  const scroller = tree?.closest(SCROLLER_SELECTOR) ?? null;
  if (tree === null || scroller === null) {
    return null;
  }
  const viewTop = scroller.getBoundingClientRect().top;
  const rows = [...tree.querySelectorAll("tr")].map((row) => {
    const { height, top } = row.getBoundingClientRect();
    const index = row.getAttribute("aria-rowindex") ?? "";
    return `${kindOf(row)}:${index}:${Math.round(top - viewTop)}:${Math.round(height)}`;
  });
  return { rows, view: `${Math.round(scroller.scrollTop)}:${scroller.clientHeight}` };
}

export { treeLayoutOf };
