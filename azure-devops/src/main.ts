import { apiBasePath, parsePullRequestListLocation } from "./pull-request-link.ts";
import { findBoardCardIds, isBoardLocation, watchBoard } from "./board.ts";
import { findPullRequestRows, markRequiredReviewers, showPipelineStatus } from "./pr-list.ts";
import type { PullRequestsResponse } from "./ado-client.ts";
import type { Reviewer } from "./reviewers.ts";
import type { WatchedPage } from "./page-reloader.ts";
import { createAdoClient } from "./ado-client.ts";
import { createPageReloader } from "./page-reloader.ts";
import { createPipelineStatusPoller } from "./pipeline-status-poller.ts";
import { showInitialsOnAvatars } from "./avatars.ts";
import style from "./style.css";
import { watchPullRequestList } from "./pr-list-watch.ts";

GM_addStyle(style);

const DOM_SETTLE_MS = 200;
const TIMER_INTERVAL_MS = 5000;
const MIN_TIME_BETWEEN_RELOADS_MS = 15_000;
const LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload";

const basePath = apiBasePath(location);
const client = createAdoClient({
  apiBasePath: basePath,
  fetch: async (url, init) => fetch(url, init),
  origin: location.origin,
});
const isTabActive = (): boolean => document.visibilityState === "visible";

const poller = createPipelineStatusPoller<HTMLElement>({
  client,
  findRows: () => findPullRequestRows(document, basePath),
  now: () => Date.now(),
  showStatus: showPipelineStatus,
});

const reviewersByPullRequestId = new Map<number, Reviewer[]>();

function markRequiredReviewersOnAllRows(): void {
  for (const { row, pullRequest } of findPullRequestRows(document, basePath)) {
    const reviewers = reviewersByPullRequestId.get(pullRequest.pullRequestId);
    if (reviewers) {
      markRequiredReviewers(row, reviewers);
    }
  }
}

const pullRequestListClient = {
  // The list check already fetches the reviewers. Keep them to mark the required ones.
  async getPullRequests(
    listPage: Parameters<typeof client.getPullRequests>[0],
  ): Promise<PullRequestsResponse> {
    const response = await client.getPullRequests(listPage);
    for (const pullRequest of response.pullRequests) {
      reviewersByPullRequestId.set(pullRequest.pullRequestId, pullRequest.reviewers ?? []);
    }
    markRequiredReviewersOnAllRows();
    return response;
  },
};

function currentWatchedPage(): WatchedPage<unknown> | null {
  const listPage = parsePullRequestListLocation(location, basePath);
  if (listPage) {
    return watchPullRequestList(pullRequestListClient, listPage, () =>
      findPullRequestRows(document, basePath).map(({ pullRequest }) => pullRequest.pullRequestId),
    );
  }
  if (isBoardLocation(location)) {
    const cardIds = findBoardCardIds(document);
    // No cards yet: the board is still loading, and there is nothing to compare.
    return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
  }
  return null;
}

const reloader = createPageReloader({
  currentPage: currentWatchedPage,
  isTabActive,
  now: () => Date.now(),
  reload: reloadPage,
});

function isUserBusy(): boolean {
  const isTyping = document.activeElement?.matches("input, textarea, [contenteditable]") ?? false;
  const hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
  return isTyping || hasOpenDialog;
}

/** Records this reload, unless the last one was too recent. False when the reload must wait. */
function claimReload(): boolean {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
    if (Date.now() - lastReloadAt < MIN_TIME_BETWEEN_RELOADS_MS) {
      return false;
    }
    sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Skipped while the user types or has a dialog open (a work item, for example),
 * and right after a reload so a bug cannot cause a reload loop. The next check retries.
 */
function reloadPage(): void {
  if (!isUserBusy() && claimReload()) {
    location.reload();
  }
}

function sync(): void {
  showInitialsOnAvatars(document);
  markRequiredReviewersOnAllRows();
  if (isTabActive()) {
    void poller.sync();
  }
  void reloader.check();
}

// ADO is a single-page app that re-renders its content. Re-apply after every DOM change.
let settleTimer: ReturnType<typeof setTimeout> | null = null;
new MutationObserver(() => {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
  }
  settleTimer = setTimeout(sync, DOM_SETTLE_MS);
}).observe(document.body, { childList: true, subtree: true });

setInterval(sync, TIMER_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!isTabActive()) {
    return;
  }
  void poller.sync();
  void reloader.check({ immediately: true });
});
sync();
