// Keeps viewed folders folded after the page loads: a folder that becomes viewed folds,
// and a viewed folder Azure DevOps opens again to show the file in view in the diff
// folds again, until the owner opens or folds a folder in the tree.
import { drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { fold, foldDrawnViewed, hasOpenViewedFolder } from "./tree-folds.ts";
import type { ShownPullRequest } from "./tree-ticks.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { isFolderView } from "./viewed-toggles.ts";
import { newlyComplete } from "./tree-ticks.ts";
import { watchOwnerFolds } from "./owner-clicks.ts";

/** The folders that became complete and should collapse: none while a single file is open. */
function foldersToCollapse(document: Document, shown: ShownPullRequest): string[] {
  const folders = newlyComplete(shown);
  return isFolderView(document) ? folders : [];
}

/** Collapses each folder that became complete, when the tree draws it. True when it clicked one. */
function foldNewlyComplete(document: Document, shown: ShownPullRequest): boolean {
  const tree = treeNow(document, shown.changedPaths);
  let isClicked = false;
  for (const folder of foldersToCollapse(document, shown)) {
    const row = drawnRowOf(folder, tree);
    if (row !== null) {
      fold(document, { path: folder, row });
      isClicked = true;
    }
  }
  return isClicked;
}

/**
 * Folds again each viewed folder the tree draws open, as work that `queue` runs after
 * the work before it. Stops when a folder does not fold.
 */
function keepViewedFolded(
  shown: ShownPullRequest,
  walk: TreeWalk,
  queue: (run: () => Promise<void>) => void,
): void {
  const { document } = walk;
  if (shown.keepsViewedFolded && isFolderView(document) && hasOpenViewedFolder(document)) {
    queue(async () => {
      shown.keepsViewedFolded = await foldDrawnViewed(walk);
    });
  }
}

/** Stops keeping viewed folders folded once the owner opens or folds a folder in the tree. */
function stopOnOwnerFolds(document: Document, shownNow: () => ShownPullRequest | null): void {
  watchOwnerFolds(document, () => {
    const shown = shownNow();
    if (shown !== null) {
      shown.keepsViewedFolded = false;
    }
  });
}

export { foldNewlyComplete, foldersToCollapse, keepViewedFolded, stopOnOwnerFolds };
