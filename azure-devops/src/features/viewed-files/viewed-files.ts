// Viewed files, as on GitHub: a Viewed toggle in each file header of the Files tab ticks
// the file in the tree, where Azure DevOps keeps what the owner reviewed. A ticked
// folder collapses, also on page load, but not while a single file is open. A viewed
// file's card starts collapsed. Expand all and Collapse viewed act on cards and tree.
import {
  TICK_SELECTOR,
  findCompleteFolders,
  isTickShown,
  isTicked,
  noteTicks,
} from "./tree-ticks.ts";
import { askCards, foldViewedCards, setAskedCards } from "./card-folds.ts";
import {
  foldFolders,
  foldViewedFolders,
  openEveryFolder,
  unfoldAbove,
  walkNoting,
} from "./tree-folds.ts";
import {
  foldNewlyComplete,
  foldersToCollapse,
  keepViewedFolded,
  stopOnOwnerFolds,
} from "./kept-folds.ts";
import { isFolderView, setCardOpen, syncViewedToggles } from "./viewed-toggles.ts";
import { keepingScroll, setSkeleton, untilTreeShows, withDrawnRow } from "./tree-walk.ts";
import { removeToolbarButtons, syncToolbarButtons } from "./toolbar-buttons.ts";
import type { ChangesClient } from "./changed-paths.ts";
import type { FileHeader } from "./viewed-toggles.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { ShownPullRequest } from "./tree-ticks.ts";
import type { ToolbarAction } from "./toolbar-buttons.ts";
import type { TreeWalk } from "./tree-walk.ts";
import { loadChangedPaths } from "./changed-paths.ts";
import { log } from "../../../../shared/runtime/script-log.ts";

const TREE_SELECTOR = ".repos-changes-explorer-tree";

interface ViewedFilesOptions {
  client: ChangesClient;
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
    .catch((error: unknown) => {
      log("Viewed files: a step failed", { error: String(error) });
    })
    .then(() => {
      if (state.work === work) {
        state.work = null;
      }
    });
  state.work = work;
}

/**
 * Walks through the whole tree once, to learn the tick of every file, and folds each
 * folder the tree ticks as it meets it, unless a single file is open.
 */
function walkWholeTree(state: ViewedState, shown: ShownPullRequest): void {
  shown.isWalkStarted = true;
  const { document } = state.options;
  queue(state, async () => {
    const started = Date.now();
    const walk = walkOf(state, shown);
    const isFolding = isFolderView(document);
    let folds = 0;
    await keepingScroll(walk, async () => {
      folds = await walkNoting(
        walk,
        () => {
          noteTicks(document, shown);
        },
        isFolding,
      );
      shown.completeFolders = findCompleteFolders(shown);
      if (isFolding) {
        // Azure DevOps may open the folders above a card that moves as the viewed cards collapse.
        foldViewedCards(document, shown);
        await foldViewedFolders(walk);
      }
    });
    log("Viewed files: first walk and folds done", {
      viewedFilesTiming: {
        changedFiles: shown.changedPaths?.length,
        completeFolders: shown.completeFolders?.size,
        folds,
        ms: Date.now() - started,
      },
    });
    render(state);
  });
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
  shown.cardsFolded.add(header.path);
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
      await foldFolders(walk, foldersToCollapse(document, shown));
    });
    // The tree did not take the tick: the card goes back to how it was.
    if (header.card !== null && (shown.fileTicks.get(header.path) === true) !== isViewed) {
      setCardOpen(header.card, isViewed);
    }
    render(state);
  });
}

/**
 * Runs a click on a toolbar button: on the cards right away, and on the tree after the
 * work before it. Collapse viewed also folds while a single file is open.
 */
function runToolbarAction(state: ViewedState, action: ToolbarAction): void {
  const { shown } = state;
  if (shown?.changedPaths === null || shown === null) {
    return;
  }
  const { changedPaths } = shown;
  const isExpand = action === "expand-all";
  const paths = isExpand
    ? changedPaths
    : changedPaths.filter((path) => shown.fileTicks.get(path) === true);
  log(isExpand ? "Viewed files: Expand all clicked" : "Viewed files: Collapse viewed clicked");
  shown.keepsViewedFolded = !isExpand;
  askCards(state.options.document, shown, { isOpen: isExpand, paths });
  queue(state, async () => {
    const walk = walkOf(state, shown);
    await keepingScroll(walk, async () => {
      await (isExpand ? openEveryFolder(walk) : foldViewedFolders(walk));
    });
    render(state);
  });
}

function render(state: ViewedState): void {
  const { shown } = state;
  const { document } = state.options;
  if (shown !== null) {
    setAskedCards(document, shown);
    foldViewedCards(document, shown);
  }
  syncToolbarButtons(document, (action) => {
    runToolbarAction(state, action);
  });
  syncViewedToggles(state.options.document, {
    isViewed: (path) => shown?.fileTicks.get(path) === true,
    onToggle: (header, isViewed) => {
      setViewed(state, header, isViewed);
    },
  });
}

function show(state: ViewedState, pullRequest: PullRequestRef): ShownPullRequest {
  const key = keyOf(pullRequest);
  if (state.shown?.key === key) {
    return state.shown;
  }
  const shown: ShownPullRequest = {
    cardsAsked: new Map(),
    cardsFolded: new Set(),
    changedPaths: null,
    completeFolders: null,
    fileTicks: new Map(),
    folderTicks: new Map(),
    isWalkStarted: false,
    keepsViewedFolded: true,
    key,
  };
  state.shown = shown;
  // The skeleton hides the unfolded tree until the first walk has read and folded it.
  setSkeleton(state.options.document, true);
  queue(state, async () => {
    try {
      shown.changedPaths = await loadChangedPaths(state.options.client, pullRequest);
    } finally {
      if (shown.changedPaths === null) {
        setSkeleton(state.options.document, false);
      }
    }
  });
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
    // A row just folded still shows open until the tree draws again: a second click would open it.
    if (!foldNewlyComplete(document, shown)) {
      keepViewedFolded(shown, walkOf(state, shown), (run) => {
        queue(state, run);
      });
    }
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
        removeToolbarButtons(options.document);
        return;
      }
      stopOnOwnerFolds(options.document, () => state.shown);
      syncTreeTicks(state, show(state, pullRequest));
      render(state);
    },
  };
}

export { createViewedFiles };
export type { ViewedFiles, ViewedFilesOptions };
