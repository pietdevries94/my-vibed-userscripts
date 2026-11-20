// The rows the file tree of the Files tab draws now, and the paths they stand for.
// The tree draws only the rows near the part in view, so a row's folders may be
// missing above it; the listing of the changed files then tells which row it is.
import type { DrawnListing } from "./tree-listing.ts";
import { findDrawn } from "./tree-listing.ts";
import { noteFolded } from "./tree-folded.ts";

const TREE_ROW_SELECTOR = ".repos-changes-explorer-tree tr.bolt-tree-row";
/** The cell content of a thread's row, of Azure DevOps's own and of the script's. */
const THREAD_ITEM_CLASS = "repos-file-explorer-tree-thread-item";
const NAME_SELECTOR = ".bolt-tree-cell .text-ellipsis";
const INDEX_ATTRIBUTE = "aria-rowindex";

/** A row of the tree that is drawn now, with the part of its path the drawn rows show. */
interface DrawnRow {
  row: Element;
  /** How deep the row sits, from its `aria-level`. */
  level: number;
  /** The name the row shows. */
  name: string;
  /** True when the tree does not draw the row before this one. */
  isAfterGap: boolean;
  /** The names of the drawn rows above it, then its own, such as "src/totals.ts". */
  pathEnd: string;
  /** False when rows above it are not drawn, so the start of its path is unknown. */
  isWholePath: boolean;
}

/** The files a pull request changes. Null when Azure DevOps has not said yet. */
type ChangedPaths = string[] | null;

/** The tree as it is now: its drawn rows, and the files it lists. */
interface TreeNow {
  drawn: DrawnRow[];
  /** Where the drawn rows are in the listing of the changed files. Null when the listing does not tell. */
  listing: DrawnListing | null;
  changedPaths: ChangedPaths;
}

function isThreadRow(row: Element | null): boolean {
  return row?.querySelector(`.${THREAD_ITEM_CLASS}`) !== null && row !== null;
}

/** True when the tree skips rows right before this one: the row before it is not the one drawn before it. */
function isAfterSkippedRows(row: Element): boolean {
  let before = row.previousElementSibling;
  while (before !== null && !before.hasAttribute(INDEX_ATTRIBUTE)) {
    before = before.previousElementSibling;
  }
  const index = Number(row.getAttribute(INDEX_ATTRIBUTE));
  return before !== null && Number(before.getAttribute(INDEX_ATTRIBUTE)) !== index - 1;
}

/**
 * The drawn rows with their paths. The tree draws only the rows near the part in
 * view, so a row's folders may be missing above it.
 */
function drawnRows(document: Document): DrawnRow[] {
  /** The name of the last row at each level. Null for a level whose row is not drawn. */
  const names: (string | null)[] = [];
  return [...document.querySelectorAll(TREE_ROW_SELECTOR)]
    .filter((row) => !isThreadRow(row))
    .map((row) => {
      const depth = Math.max(Number(row.getAttribute("aria-level")) - 1, 0);
      while (names.length < depth) {
        names.push(null);
      }
      names.length = depth;
      const name = row.querySelector(NAME_SELECTOR)?.textContent.trim() ?? "";
      names.push(name);
      const firstKnown = names.lastIndexOf(null) + 1;
      const pathEnd = names.slice(firstKnown).join("/").split("/").filter(Boolean).join("/");
      const isAfterGap = isAfterSkippedRows(row);
      return { isAfterGap, isWholePath: firstKnown === 0, level: depth + 1, name, pathEnd, row };
    });
}

/** True when the row is this file's. A path's start that is not drawn must leave one file only. */
function isRowOf(drawn: DrawnRow, filePath: string, changedPaths: ChangedPaths): boolean {
  const end = `/${drawn.pathEnd}`;
  if (drawn.isWholePath) {
    // The tree's first row may name the repository, which a file's path leaves out.
    return end === filePath || end.endsWith(filePath);
  }
  const sameEnd = (changedPaths ?? []).filter((path) => path.endsWith(end));
  return filePath.endsWith(end) && sameEnd.length === 1;
}

/** The tree row of a file, or null when it is not drawn or cannot be told apart. */
function fileRowOf(
  drawn: DrawnRow[],
  filePath: string,
  changedPaths: ChangedPaths,
): Element | null {
  return drawn.find((candidate) => isRowOf(candidate, filePath, changedPaths))?.row ?? null;
}

/**
 * The drawn row of a file or folder, or null when the tree does not draw it. The
 * listing of the changed files tells which row it is; without it, the paths the drawn
 * rows show do.
 */
function drawnRowOf(path: string, { changedPaths, drawn, listing }: TreeNow): Element | null {
  const place = listing?.paths.indexOf(path) ?? -1;
  if (listing === null || place === -1) {
    return fileRowOf(drawn, path, changedPaths);
  }
  return drawn[listing.placeOfDrawn.indexOf(place)]?.row ?? null;
}

/** The path each drawn row stands for, in drawn order. Null for a row the listing does not place. */
function drawnPaths({ drawn, listing }: TreeNow): (string | null)[] {
  return drawn.map((_row, index) => {
    const place = listing?.placeOfDrawn[index];
    return place === undefined ? null : (listing?.paths[place] ?? null);
  });
}

/** The tree as it is now. Also notes which rows the owner folded. */
function treeNow(document: Document, changedPaths: ChangedPaths): TreeNow {
  const drawn = drawnRows(document);
  const folded = noteFolded(document, drawn, changedPaths);
  const listing = changedPaths === null ? null : findDrawn(changedPaths, drawn, folded);
  return { changedPaths, drawn, listing };
}

export { THREAD_ITEM_CLASS, drawnPaths, drawnRowOf, isThreadRow, treeNow };
export type { ChangedPaths, TreeNow };
