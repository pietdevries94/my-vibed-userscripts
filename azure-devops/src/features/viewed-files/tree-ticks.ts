// What the script knows of the ticks in the file tree. The tree draws only the rows
// near the part in view, so the script notes each tick it sees, and keeps it.
import { drawnPaths, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { listedRows } from "../../pull-requests/file-tree/tree-listing.ts";

const TICK_SELECTOR = ".bolt-checkbox";

/** What the script knows of the pull request on the page. */
interface ShownPullRequest {
  key: string;
  /** The files the newest iteration changes. Null until Azure DevOps answered. */
  changedPaths: string[] | null;
  /** The tick of each file, as the tree last drew it. */
  fileTicks: Map<string, boolean>;
  /** The tick of each folder row, as the tree last drew it. */
  folderTicks: Map<string, boolean>;
  /** The folders whose files are all ticked. Null until the first walk through the tree. */
  completeFolders: Set<string> | null;
  isWalkStarted: boolean;
  /** The files whose card got its first fold: collapsed when the file was viewed, left open when not. */
  cardsFolded: Set<string>;
  /** The state a toolbar button asked for the cards of files the page has not drawn yet: true for open. */
  cardsAsked: Map<string, boolean>;
}

function isTicked(row: Element): boolean {
  return row.querySelector(TICK_SELECTOR)?.getAttribute("aria-checked") === "true";
}

function filesUnder(shown: ShownPullRequest, folder: string): string[] {
  return (shown.changedPaths ?? []).filter((path) => path.startsWith(`${folder}/`));
}

/** The paths whose drawn tick changed since the tree last drew them. */
interface ChangedTicks {
  files: string[];
  folders: string[];
}

/** Notes the tick of a drawn row. True when it changed since the tree last drew it. */
function noteTick(shown: ShownPullRequest, path: string, row: Element): boolean {
  const known = shown.changedPaths?.includes(path) === true ? shown.fileTicks : shown.folderTicks;
  const before = known.get(path);
  known.set(path, isTicked(row));
  return before !== undefined && before !== known.get(path);
}

/** Notes the tick of every drawn row, and returns the ones that changed. */
function noteDrawnTicks(document: Document, shown: ShownPullRequest): ChangedTicks {
  const files = new Set(shown.changedPaths);
  const tree = treeNow(document, shown.changedPaths);
  const changed: ChangedTicks = { files: [], folders: [] };
  for (const [index, path] of drawnPaths(tree).entries()) {
    const row = tree.drawn[index]?.row;
    if (path !== null && row !== undefined && noteTick(shown, path, row)) {
      (files.has(path) ? changed.files : changed.folders).push(path);
    }
  }
  return changed;
}

/**
 * Notes the ticks the tree draws now. A folder's tick that changed without a tick of
 * a file under it is the owner's click on the folder, which ticks every file in it.
 */
function noteTicks(document: Document, shown: ShownPullRequest): void {
  const changed = noteDrawnTicks(document, shown);
  const clickedFolders = changed.folders.filter(
    (folder) => !changed.files.some((file) => file.startsWith(`${folder}/`)),
  );
  for (const folder of clickedFolders) {
    const tick = shown.folderTicks.get(folder) === true;
    for (const file of filesUnder(shown, folder)) {
      shown.fileTicks.set(file, tick);
    }
  }
}

/**
 * The folder rows whose files are all ticked. One pass over the files: an unticked
 * file leaves each folder above it incomplete. A large pull request syncs often.
 */
function findCompleteFolders(shown: ShownPullRequest): Set<string> {
  const changedPaths = shown.changedPaths ?? [];
  const files = new Set(changedPaths);
  const complete = new Set(
    listedRows(changedPaths)
      .map(({ path }) => path)
      .filter((path) => !files.has(path)),
  );
  for (const file of changedPaths) {
    if (shown.fileTicks.get(file) !== true) {
      for (let end = file.lastIndexOf("/"); end > 0; end = file.lastIndexOf("/", end - 1)) {
        complete.delete(file.slice(0, end));
      }
    }
  }
  return complete;
}

/** The folders that are not inside another of them. */
function outermost(folders: string[]): string[] {
  return folders.filter((folder) => !folders.some((other) => folder.startsWith(`${other}/`)));
}

/** The outermost folders that became complete since last time. Notes the complete folders. */
function newlyComplete(shown: ShownPullRequest): string[] {
  const before = shown.completeFolders;
  const now = findCompleteFolders(shown);
  shown.completeFolders = now;
  if (before === null) {
    return [];
  }
  return outermost([...now].filter((folder) => !before.has(folder)));
}

export { findCompleteFolders, isTicked, newlyComplete, noteTicks, outermost, TICK_SELECTOR };
export type { ShownPullRequest };
