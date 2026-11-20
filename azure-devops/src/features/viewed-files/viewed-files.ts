// Viewed files, as on GitHub: a Viewed toggle in each file's header in the Files tab
// ticks the file in the tree on the left, where Azure DevOps keeps which files the
// owner reviewed. The toggle shows the tree's tick, so both stay the same. A folder
// whose files are all ticked collapses in the tree, but not when the page loads, and
// not while a single file is open.
import {
  TICK_SELECTOR,
  findCompleteFolders,
  isTicked,
  newlyComplete,
  noteTicks,
} from "./tree-ticks.ts";
import { drawnRowOf, treeNow } from "../../pull-requests/file-tree/tree-rows.ts";
import { isFolderView, setCardOpen, syncViewedToggles } from "./viewed-toggles.ts";
import { keepingScroll, untilTreeShows, walkTree, withDrawnRow } from "./tree-walk.ts";
import type { FileHeader } from "./viewed-toggles.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { ReviewRequests } from "../../pull-requests/review-requests.ts";
import type { ShownPullRequest } from "./tree-ticks.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { foldedPaths } from "../../pull-requests/file-tree/tree-folded.ts";

const TREE_SELECTOR = ".repos-changes-explorer-tree";
const FOLD_SELECTOR = ".bolt-tree-expand-button";

interface ViewedFilesOptions {
  client: Pick<ReviewRequests, "getIterationChanges" | "getPullRequestIterationIds">;
  document: Document;
  /** The safety cap on a wait for the tree to draw. Each wait ends on the tree's change. */
  drawTimeoutMs: number;
  /** The safety cap on a wait for the tree to show a clicked tick: Azure DevOps may save it first. */
  tickTimeoutMs: number;
}

interface ViewedFiles {
  sync: (pullRequest: PullRequestRef | null) => void;
  /** Resolves when the script is done with the tree for now. Tests wait on it. */
  idle: () => Promise<void>;
}

interface ViewedState {
  options: ViewedFilesOptions;
  shown: ShownPullRequest | null;
  /** The script's work on the tree now; the next waits for it. */
  work: Promise<void> | null;
}

function keyOf({ project, pullRequestId, repository }: PullRequestRef): string {
  return `${project}/${repository}/${String(pullRequestId)}`;
}

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

/** The folders that became complete and should collapse: none while a single file is open. */
function foldersToCollapse(document: Document, shown: ShownPullRequest): string[] {
  const folders = newlyComplete(shown);
  return isFolderView(document) ? folders : [];
}

/** Collapses each folder that became complete, when the tree draws it. */
function foldNewlyComplete(document: Document, shown: ShownPullRequest): void {
  const tree = treeNow(document, shown.changedPaths);
  for (const folder of foldersToCollapse(document, shown)) {
    const row = drawnRowOf(folder, tree);
    if (row !== null) {
      fold(row);
    }
  }
}

function walkOf({ options }: ViewedState, shown: ShownPullRequest): TreeWalk {
  return {
    changedPaths: shown.changedPaths,
    document: options.document,
    drawTimeoutMs: options.drawTimeoutMs,
  };
}

/** Runs work on the tree after the work before it. */
function queue(state: ViewedState, run: () => Promise<void>): void {
  const before = state.work ?? Promise.resolve();
  const work: Promise<void> = before
    .then(run)
    // A failed step leaves the tree as it is; the next sync tries again.
    .catch(() => null)
    .then(() => {
      if (state.work === work) {
        state.work = null;
      }
    });
  state.work = work;
}

/** Walks through the whole tree once, to learn the tick of every file. */
function walkWholeTree(state: ViewedState, shown: ShownPullRequest): void {
  shown.isWalkStarted = true;
  const { document } = state.options;
  queue(state, async () => {
    const walk = walkOf(state, shown);
    await keepingScroll(walk, async () => {
      await walkTree(walk, () => {
        noteTicks(document, shown);
        return false;
      });
    });
    shown.completeFolders = findCompleteFolders(shown);
    render(state);
  });
}

/** Unfolds the folded folders above `path`, from the outermost in. */
async function unfoldAbove(walk: TreeWalk, path: string): Promise<void> {
  const above = [...foldedPaths(walk.document)]
    .filter((folder) => path.startsWith(`${folder}/`))
    .toSorted((left, right) => left.length - right.length);
  for (const folder of above) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one walk at a time: each scrolls the same tree
    await withDrawnRow(walk, folder, async (row) =>
      setFolderOpen(walk, { path: folder, row }, true),
    );
  }
}

/** True when the tree draws the row of `path` with the tick `isViewed`. */
function isTickShown(walk: TreeWalk, path: string, isViewed: boolean): boolean {
  const row = drawnRowOf(path, treeNow(walk.document, walk.changedPaths));
  return row !== null && isTicked(row) === isViewed;
}

/**
 * Collapses or opens a file's card right away, then ticks or unticks the file in the
 * tree and collapses a folder it completes. The card goes back when the tree does not
 * take the tick.
 */
function setViewed(state: ViewedState, header: FileHeader, isViewed: boolean): void {
  const { shown } = state;
  if (shown === null) {
    return;
  }
  const { document, tickTimeoutMs } = state.options;
  if (header.card !== null) {
    setCardOpen(header.card, !isViewed);
  }
  queue(state, async () => {
    const walk = walkOf(state, shown);
    await keepingScroll(walk, async () => {
      await unfoldAbove(walk, header.path);
      await withDrawnRow(walk, header.path, async (row) => {
        if (isTicked(row) !== isViewed) {
          row.querySelector<HTMLElement>(TICK_SELECTOR)?.click();
          await untilTreeShows(walk, () => isTickShown(walk, header.path, isViewed), tickTimeoutMs);
        }
      });
      noteTicks(document, shown);
      for (const folder of foldersToCollapse(document, shown)) {
        // Waiting on the fold also notes it, so the listing leaves out the rows under it.
        // oxlint-disable-next-line eslint/no-await-in-loop -- one walk at a time: each scrolls the same tree
        await withDrawnRow(walk, folder, async (row) =>
          setFolderOpen(walk, { path: folder, row }, false),
        );
      }
    });
    // The tree did not take the tick: the card goes back to how it was.
    if (header.card !== null && (shown.fileTicks.get(header.path) === true) !== isViewed) {
      setCardOpen(header.card, isViewed);
    }
    render(state);
  });
}

function render(state: ViewedState): void {
  const { shown } = state;
  syncViewedToggles(state.options.document, {
    isViewed: (path) => shown?.fileTicks.get(path) === true,
    onToggle: (header, isViewed) => {
      setViewed(state, header, isViewed);
    },
  });
}

/** Asks which iteration is the newest, and which files it changes. */
async function loadChangedPaths(
  state: ViewedState,
  shown: ShownPullRequest,
  pullRequest: PullRequestRef,
): Promise<void> {
  const { client } = state.options;
  const ids = await client.getPullRequestIterationIds(pullRequest);
  if (ids.length > 0) {
    const changes = await client.getIterationChanges(pullRequest, Math.max(...ids));
    shown.changedPaths = changes.flatMap(({ item }) => item?.path ?? []);
  }
}

function show(state: ViewedState, pullRequest: PullRequestRef): ShownPullRequest {
  const key = keyOf(pullRequest);
  if (state.shown?.key === key) {
    return state.shown;
  }
  const shown: ShownPullRequest = {
    changedPaths: null,
    completeFolders: null,
    fileTicks: new Map(),
    folderTicks: new Map(),
    isWalkStarted: false,
    key,
  };
  state.shown = shown;
  queue(state, async () => loadChangedPaths(state, shown, pullRequest));
  return shown;
}

/** Notes the tree's ticks, and starts the first walk or folds what became complete. */
function syncTreeTicks(state: ViewedState, shown: ShownPullRequest): void {
  const { document } = state.options;
  // While the script walks the tree, the rows it draws are the walk's to read.
  if (shown.changedPaths === null || state.work !== null) {
    return;
  }
  noteTicks(document, shown);
  if (shown.isWalkStarted) {
    foldNewlyComplete(document, shown);
  } else {
    walkWholeTree(state, shown);
  }
}

function createViewedFiles(options: ViewedFilesOptions): ViewedFiles {
  const state: ViewedState = { options, shown: null, work: null };
  return {
    idle: async () => {
      while (state.work !== null) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- work queued meanwhile runs after this
        await state.work;
      }
    },
    sync(pullRequest) {
      if (pullRequest === null || options.document.querySelector(TREE_SELECTOR) === null) {
        return;
      }
      syncTreeTicks(state, show(state, pullRequest));
      render(state);
    },
  };
}

export { createViewedFiles };
export type { ViewedFiles, ViewedFilesOptions };
