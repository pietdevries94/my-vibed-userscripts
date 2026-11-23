// Opens and folds folder rows of the file tree, as their chevrons do.
import { drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { untilTreeShows, withDrawnRow } from "./tree-walk.ts";
import type { TreeWalk } from "./tree-walk.ts";

const FOLD_SELECTOR = ".bolt-tree-expand-button";

/** True when the tree draws the row of the folder at `path`, open or folded as asked. */
function isFoldShown(walk: TreeWalk, path: string, isOpen: boolean): boolean {
  const row = drawnRowOf(path, treeNow(walk.document, walk.changedPaths));
  return row?.getAttribute("aria-expanded") === String(isOpen);
}

/** Opens or folds a folder's row, as its chevron does, and waits until the tree shows it. */
async function setFolderOpen(
  walk: TreeWalk,
  { path, row }: { path: string; row: Element },
  isOpen: boolean,
): Promise<void> {
  if (row.getAttribute("aria-expanded") !== String(isOpen)) {
    row.querySelector<HTMLElement>(FOLD_SELECTOR)?.click();
    await untilTreeShows(walk, () => isFoldShown(walk, path, isOpen), walk.drawTimeoutMs);
  }
}

/** Collapses a folder row, as its chevron does. */
function fold(row: Element): void {
  if (row.getAttribute("aria-expanded") === "true") {
    row.querySelector<HTMLElement>(FOLD_SELECTOR)?.click();
  }
}

/** Folds each folder, waiting until the tree shows it, one at a time. */
async function foldFolders(walk: TreeWalk, folders: string[]): Promise<void> {
  for (const folder of folders) {
    // Waiting on the fold also notes it, so the listing leaves out the rows under it.
    // oxlint-disable-next-line eslint/no-await-in-loop -- one walk at a time: each scrolls the same tree
    await withDrawnRow(walk, folder, async (row) =>
      setFolderOpen(walk, { path: folder, row }, false),
    );
  }
}

export { fold, foldFolders, setFolderOpen };
