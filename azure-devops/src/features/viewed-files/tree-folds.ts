// Opens and folds folder rows of the file tree, as their chevrons do.
import { drawnPaths, drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { foldedPaths, noteOwnFold } from "../../pull-requests/file-tree/tree-folded.ts";
import { untilTreeShows, walkTree } from "./tree-walk.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { clickForScript } from "./owner-clicks.ts";
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
    clickForScript(row.querySelector<HTMLElement>(FOLD_SELECTOR));
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
    clickForScript(row.querySelector<HTMLElement>(FOLD_SELECTOR));
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
  clickForScript(row.querySelector<HTMLElement>(FOLD_SELECTOR));
  if (path !== null && path !== undefined) {
    noteOwnFold(walk.document, path, !isOpen);
  }
  return untilTreeShows(
    walk,
    () => folderRowAt(walk.document, index)?.getAttribute("aria-expanded") === String(isOpen),
    walk.drawTimeoutMs,
  );
}

/** A run of chevron clicks on the folder rows that `isPicked` picks. */
interface Clicking {
  isOpen: boolean;
  isPicked: (row: Element) => boolean;
  clicks: number;
  /** The places of rows that did not take a click, so the run does not click them again. */
  stuck: Set<string>;
}

function clicking(isOpen: boolean, isPicked: (row: Element) => boolean): Clicking {
  return { clicks: 0, isOpen, isPicked, stuck: new Set() };
}

/** Clicks the chevron of every drawn folder row the run picks, from the top. */
async function clickDrawnPicked(walk: TreeWalk, run: Clicking): Promise<void> {
  const nextRow = (): Element | null =>
    [...walk.document.querySelectorAll(FOLDER_ROW_SELECTOR)].find(
      (row) => run.isPicked(row) && !run.stuck.has(row.getAttribute("aria-rowindex") ?? ""),
    ) ?? null;
  for (let row = nextRow(); row !== null; row = nextRow()) {
    run.clicks += 1;
    // oxlint-disable-next-line eslint/no-await-in-loop -- each click moves the rows the next one is read from
    if (!(await clickChevron(walk, row, run.isOpen))) {
      run.stuck.add(row.getAttribute("aria-rowindex") ?? "");
    }
  }
}

function logClicks(run: Clicking, started: number): void {
  log("Viewed files: clicked every picked folder", {
    isOpen: run.isOpen,
    viewedFilesTiming: { clicks: run.clicks, ms: Date.now() - started, stuck: run.stuck.size },
  });
}

/**
 * Walks through the tree from the top and clicks the chevron of every folder row the
 * run picks, as the tree draws it. Reads only what the rows show, not their paths.
 */
async function clickEveryPicked(walk: TreeWalk, run: Clicking): Promise<void> {
  const started = Date.now();
  await walkTree(walk, async () => {
    await clickDrawnPicked(walk, run);
    return false;
  });
  logClicks(run, started);
}

/** Picks an open folder the tree ticks: its files are all viewed. */
function isOpenViewedFolder(row: Element): boolean {
  return row.getAttribute("aria-expanded") === "true" && isTicked(row);
}

/** A run that folds every open folder the tree ticks. From the top, an outer one folds before the ones inside. */
function viewedFolding(): Clicking {
  return clicking(false, isOpenViewedFolder);
}

/** Folds every open folder the tree ticks, in one walk through the tree. */
async function foldViewedFolders(walk: TreeWalk): Promise<void> {
  await clickEveryPicked(walk, viewedFolding());
}

/** Opens every folded folder, the ones inside included. */
async function openEveryFolder(walk: TreeWalk): Promise<void> {
  await clickEveryPicked(
    walk,
    clicking(true, (row) => row.getAttribute("aria-expanded") === "false"),
  );
}

/** True when the tree draws an open folder it ticks. */
function hasOpenViewedFolder(document: Document): boolean {
  return [...document.querySelectorAll(FOLDER_ROW_SELECTOR)].some((row) => isOpenViewedFolder(row));
}

/** Folds every open folder the tree ticks among the rows drawn now. False when one did not fold. */
async function foldDrawnViewed(walk: TreeWalk): Promise<boolean> {
  const run = viewedFolding();
  await clickDrawnPicked(walk, run);
  return run.stuck.size === 0;
}

/**
 * Walks through the whole tree and calls `note` at each step. With `isFolding`, it also
 * folds each open folder the tree ticks as it meets it. Returns how many it folded.
 */
async function walkNoting(walk: TreeWalk, note: () => void, isFolding: boolean): Promise<number> {
  const run = viewedFolding();
  await walkTree(walk, async () => {
    note();
    await (isFolding ? clickDrawnPicked(walk, run) : undefined);
    return false;
  });
  return run.clicks;
}

export {
  fold,
  foldDrawnViewed,
  foldFolders,
  foldViewedFolders,
  hasOpenViewedFolder,
  openEveryFolder,
  unfoldAbove,
  walkNoting,
};
