import { AdoRequestError, type AdoClient } from "./ado-client.ts";
import { hasListChanged, snapshotOf, type PullRequestListSnapshot } from "./pr-list-changes.ts";
import type { PullRequestListPage } from "./pull-request-link.ts";

export const LIST_CHECK_INTERVAL_MS = 30_000;
export const FAILED_LIST_CHECK_RETRY_MS = 60_000;

interface ReloaderOptions {
  client: AdoClient;
  now: () => number;
  /** The pull request list the browser shows, or null on another page. */
  currentListPage: () => PullRequestListPage | null;
  onScreenPullRequestIds: () => number[];
  isTabActive: () => boolean;
  reload: () => void;
}

/**
 * Reloads the pull request list page when the list on the server differs from
 * what the page loaded. Checks only while the tab is active, except for the
 * first check of a list, which records what the page loaded.
 */
export function createPullRequestListReloader(options: ReloaderOptions) {
  // Kept for the whole page lifetime. ADO can show a cached list after
  // in-app navigation, so the snapshot from the first visit stays the reference.
  const loadedSnapshots = new Map<string, PullRequestListSnapshot>();
  let nextCheckAt = 0;
  let pausedUntil = 0;
  let isChecking = false;

  return {
    /** `immediately` skips the wait between checks. Use it when the tab becomes active. */
    async check({ immediately = false } = {}): Promise<void> {
      const listPage = options.currentListPage();
      if (!listPage || isChecking) return;
      const listKey = JSON.stringify(listPage);
      const loadedSnapshot = loadedSnapshots.get(listKey);
      if (loadedSnapshot) {
        if (!options.isTabActive() || options.now() < pausedUntil) return;
        if (!immediately && options.now() < nextCheckAt) return;
      }

      isChecking = true;
      try {
        const response = await options.client.getPullRequests(listPage);
        if (response.retryAfterSeconds !== null) pausedUntil = options.now() + response.retryAfterSeconds * 1000;
        nextCheckAt = options.now() + LIST_CHECK_INTERVAL_MS;
        const currentSnapshot = snapshotOf(response.pullRequests);
        if (!loadedSnapshot) {
          loadedSnapshots.set(listKey, currentSnapshot);
        } else if (hasListChanged(loadedSnapshot, currentSnapshot, options.onScreenPullRequestIds())) {
          options.reload();
        }
      } catch (error) {
        if (error instanceof AdoRequestError && error.retryAfterSeconds !== null) {
          pausedUntil = options.now() + error.retryAfterSeconds * 1000;
        }
        nextCheckAt = options.now() + FAILED_LIST_CHECK_RETRY_MS;
      } finally {
        isChecking = false;
      }
    },
  };
}
