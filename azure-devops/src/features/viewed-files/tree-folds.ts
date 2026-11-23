// Opens and folds folder rows of the file tree, as their chevrons do.
import { drawnPaths, drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { foldedPaths, noteOwnFold } from "../../pull-requests/file-tree/tree-folded.ts";
import { untilTreeShows, walkTree } from "./tree-walk.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { isTicked } from "./tree-ticks.ts";
import { log } from "../../../../shared/runtime/script-log.ts";

const FOLD_SELECTOR = ".bolt-tree-expand-button";
const FOLDER_ROW_SELECTOR = ".repos-changes-explorer-tree tr.bolt-tree-row[aria-expanded]";

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

/** The drawn folder row at a place in the tree, by its `aria-rowindex`. */
function folderRowAt(document: Document, index: string): Element | null {
  return document.querySelector(`${FOLDER_ROW_SELECTOR}[aria-rowindex="${index}"]`);
}

/**
 * Clicks a folder row's chevron and waits until the tree shows it open or folded. Notes
 * the fold under the row's path when the script can tell it. False when the tree did not
 * take the click.
 */
async function clickChevron(walk: TreeWalk, row: Element, isOpen: boolean): Promise<boolean> {
  const tree = treeNow(walk.document, walk.changedPaths);
  const path = drawnPaths(tree)[tree.drawn.findIndex((drawn) => drawn.row === row)];
  const index = row.getAttribute("aria-rowindex") ?? "";
  row.querySelector<HTMLElement>(FOLD_SELECTOR)?.click();
  if (path !== null && path !== undefined) {
    noteOwnFold(walk.document, path, !isOpen);
  }
  return untilTreeShows(
    walk,
    () => folderRowAt(walk.document, index)?.getAttribute("aria-expanded") === String(isOpen),
    walk.drawTimeoutMs,
  );
}

/**
 * Walks through the tree from the top and clicks the chevron of every folder row that
 * `isPicked` picks, as the tree draws it. Reads only what the rows show, not their paths.
 */
async function clickEveryPicked(
  walk: TreeWalk,
  isOpen: boolean,
  isPicked: (row: Element) => boolean,
): Promise<void> {
  /** The places of rows that did not take a click, so the walk does not click them again. */
  const stuck = new Set<string>();
  const nextRow = (): Element | null =>
    [...walk.document.querySelectorAll(FOLDER_ROW_SELECTOR)].find(
      (row) => isPicked(row) && !stuck.has(row.getAttribute("aria-rowindex") ?? ""),
    ) ?? null;
  const started = Date.now();
  let clicks = 0;
  await walkTree(walk, async () => {
    for (let row = nextRow(); row !== null; row = nextRow()) {
      clicks += 1;
      // oxlint-disable-next-line eslint/no-await-in-loop -- each click moves the rows the next one is read from
      if (!(await clickChevron(walk, row, isOpen))) {
        stuck.add(row.getAttribute("aria-rowindex") ?? "");
      }
    }
    return false;
  });
  log("Viewed files: clicked every picked folder", {
    isOpen,
    viewedFilesTiming: { clicks, ms: Date.now() - started, stuck: stuck.size },
  });
}

/**
 * Folds every open folder the tree ticks: its files are all viewed. The walk goes from
 * the top, so it folds an outer folder before it reaches the ones inside.
 */
async function foldViewedFolders(walk: TreeWalk): Promise<void> {
  await clickEveryPicked(
    walk,
    false,
    (row) => row.getAttribute("aria-expanded") === "true" && isTicked(row),
  );
}

/** Opens every folded folder, the ones inside included. */
async function openEveryFolder(walk: TreeWalk): Promise<void> {
  await clickEveryPicked(walk, true, (row) => row.getAttribute("aria-expanded") === "false");
}

export { fold, foldFolders, foldViewedFolders, openEveryFolder, unfoldAbove };
