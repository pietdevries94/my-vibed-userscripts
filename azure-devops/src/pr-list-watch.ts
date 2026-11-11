import type { AdoClient } from "./ado-client.ts";
import type { WatchedPage } from "./page-reloader.ts";
import { hasListChanged, snapshotOf, type PullRequestListSnapshot } from "./pr-list-changes.ts";
import type { PullRequestListPage } from "./pull-request-link.ts";

/** Watches a repository pull request list for added, removed and changed pull requests. */
export function watchPullRequestList(
  client: Pick<AdoClient, "getPullRequests">,
  listPage: PullRequestListPage,
  onScreenPullRequestIds: () => number[],
): WatchedPage<PullRequestListSnapshot> {
  return {
    key: `pull-request-list:${JSON.stringify(listPage)}`,
    async fetchSnapshot() {
      const { pullRequests, retryAfterSeconds } = await client.getPullRequests(listPage);
      return { snapshot: snapshotOf(pullRequests), retryAfterSeconds };
    },
    hasChanged: (loaded, current) => hasListChanged(loaded, current, onScreenPullRequestIds()),
  };
}
