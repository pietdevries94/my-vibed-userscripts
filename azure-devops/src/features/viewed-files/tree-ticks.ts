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

/** The folder rows whose files are all ticked. */
function findCompleteFolders(shown: ShownPullRequest): Set<string> {
  const files = new Set(shown.changedPaths);
  const folders = listedRows(shown.changedPaths ?? [])
    .map(({ path }) => path)
    .filter((path) => !files.has(path));
  return new Set(
    folders.filter((folder) =>
      filesUnder(shown, folder).every((file) => shown.fileTicks.get(file) === true),
    ),
  );
}

/** The outermost folders that became complete since last time. Notes the complete folders. */
function newlyComplete(shown: ShownPullRequest): string[] {
  const before = shown.completeFolders;
  const now = findCompleteFolders(shown);
  shown.completeFolders = now;
  if (before === null) {
    return [];
  }
  const added = [...now].filter((folder) => !before.has(folder));
  return added.filter((folder) => !added.some((other) => folder.startsWith(`${other}/`)));
}

export { findCompleteFolders, isTicked, newlyComplete, noteTicks, TICK_SELECTOR };
export type { ShownPullRequest };
