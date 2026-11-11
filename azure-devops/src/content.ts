import { createAdoClient } from "./ado-client.ts";
import { showInitialsOnAvatars } from "./avatars.ts";
import { findBoardCardIds, isBoardLocation, watchBoard } from "./board.ts";
import { createPageReloader, type WatchedPage } from "./page-reloader.ts";
import { createPipelineStatusPoller } from "./pipeline-status-poller.ts";
import { findPullRequestRows, markRequiredReviewers, showPipelineStatus } from "./pr-list.ts";
import { watchPullRequestList } from "./pr-list-watch.ts";
import { apiBasePath, parsePullRequestListLocation } from "./pull-request-link.ts";
import type { Reviewer } from "./reviewers.ts";

const DOM_SETTLE_MS = 200;
const TIMER_INTERVAL_MS = 5_000;
const MIN_TIME_BETWEEN_RELOADS_MS = 15_000;
const LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload";

const basePath = apiBasePath(location);
const client = createAdoClient({
  origin: location.origin,
  apiBasePath: basePath,
  fetch: (url, init) => fetch(url, init),
});
const isTabActive = () => document.visibilityState === "visible";

const poller = createPipelineStatusPoller<HTMLElement>({
  client,
  now: () => Date.now(),
  findRows: () => findPullRequestRows(document, basePath),
  showStatus: showPipelineStatus,
});

const reviewersByPullRequestId = new Map<number, Reviewer[]>();

function markRequiredReviewersOnAllRows(): void {
  for (const { row, pullRequest } of findPullRequestRows(document, basePath)) {
    const reviewers = reviewersByPullRequestId.get(pullRequest.pullRequestId);
    if (reviewers) markRequiredReviewers(row, reviewers);
  }
}

const pullRequestListClient = {
  // The list check already fetches the reviewers. Keep them to mark the required ones.
  async getPullRequests(listPage: Parameters<typeof client.getPullRequests>[0]) {
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
      findPullRequestRows(document, basePath).map(({ pullRequest }) => pullRequest.pullRequestId));
  }
  if (isBoardLocation(location)) {
    const cardIds = findBoardCardIds(document);
    // No cards yet: the board is still loading, and there is nothing to compare.
    return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
  }
  return null;
}

const reloader = createPageReloader({
  now: () => Date.now(),
  currentPage: currentWatchedPage,
  isTabActive,
  reload: reloadPage,
});

/**
 * Skipped while the user types or has a dialog open (a work item, for example),
 * and right after a reload so a bug cannot cause a reload loop. The next check retries.
 */
function reloadPage(): void {
  const isTyping = document.activeElement?.matches("input, textarea, [contenteditable]") ?? false;
  const hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
  if (isTyping || hasOpenDialog) return;
  try {
    const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
    if (Date.now() - lastReloadAt < MIN_TIME_BETWEEN_RELOADS_MS) return;
    sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

function sync(): void {
  showInitialsOnAvatars(document);
  markRequiredReviewersOnAllRows();
  if (isTabActive()) void poller.sync();
  void reloader.check();
}

// ADO is a single-page app that re-renders its content. Re-apply after every DOM change.
let settleTimer: ReturnType<typeof setTimeout> | undefined;
new MutationObserver(() => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(sync, DOM_SETTLE_MS);
}).observe(document.body, { childList: true, subtree: true });

setInterval(sync, TIMER_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!isTabActive()) return;
  void poller.sync();
  void reloader.check({ immediately: true });
});
sync();
