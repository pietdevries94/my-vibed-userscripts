// Opens and folds folder rows of the file tree, as their chevrons do.
import { drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { foldedPaths, noteOwnFold } from "../../pull-requests/file-tree/tree-folded.ts";
import { untilTreeShows, walkTree } from "./tree-walk.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { log } from "../../../../shared/runtime/script-log.ts";

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
    noteOwnFold(walk.document, path, !isOpen);
    // The clicked row shows the fold when the tree keeps it; a row drawn anew is found by its path.
    await untilTreeShows(
      walk,
      () =>
        row.isConnected
          ? row.getAttribute("aria-expanded") === String(isOpen)
          : isFoldShown(walk, path, isOpen),
      walk.drawTimeoutMs,
    );
  }
}

/** Collapses a folder row, as its chevron does. */
function fold(document: Document, { path, row }: { path: string; row: Element }): void {
  if (row.getAttribute("aria-expanded") === "true") {
    row.querySelector<HTMLElement>(FOLD_SELECTOR)?.click();
    noteOwnFold(document, path, true);
  }
}

/** A row the tree draws now of one of these folders, or null. */
function drawnFolder(walk: TreeWalk, folders: Set<string>): { path: string; row: Element } | null {
  const tree = treeNow(walk.document, walk.changedPaths);
  for (const path of folders) {
    const row = drawnRowOf(path, tree);
    if (row !== null) {
      return { path, row };
    }
  }
  return null;
}

/**
 * Opens or folds these folders in one walk from the top: at each step, every one the
 * tree draws there. A folder inside another is drawn below it, so the walk meets the
 * outer one first.
 */
async function setFoldersOpen(walk: TreeWalk, folders: string[], isOpen: boolean): Promise<void> {
  const left = new Set(folders);
  if (left.size === 0) {
    return;
  }
  const started = Date.now();
  await walkTree(walk, async () => {
    for (let found = drawnFolder(walk, left); found !== null; found = drawnFolder(walk, left)) {
      left.delete(found.path);
      // oxlint-disable-next-line eslint/no-await-in-loop -- each fold moves the rows the next one is read from
      await setFolderOpen(walk, found, isOpen);
    }
    return left.size === 0;
  });
  log("Viewed files: opened or folded folders", {
    isOpen,
    viewedFilesTiming: { asked: folders.length, missed: left.size, ms: Date.now() - started },
  });
}

/** Folds these folders, in one walk through the tree. */
async function foldFolders(walk: TreeWalk, folders: string[]): Promise<void> {
  await setFoldersOpen(walk, folders, false);
}

/** Unfolds the folded folders above `path`, in one walk through the tree. */
async function unfoldAbove(walk: TreeWalk, path: string): Promise<void> {
  await setFoldersOpen(
    walk,
    [...foldedPaths(walk.document)].filter((folder) => path.startsWith(`${folder}/`)),
    true,
  );
}

/** Unfolds every folded folder, in one walk through the tree. */
async function unfoldAll(walk: TreeWalk): Promise<void> {
  await setFoldersOpen(walk, [...foldedPaths(walk.document)], true);
}

export { fold, foldFolders, unfoldAbove, unfoldAll };
