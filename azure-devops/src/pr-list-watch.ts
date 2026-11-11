import { hasListChanged, snapshotOf } from "./pr-list-changes.ts";
import type { AdoClient } from "./ado-client.ts";
import type { PullRequestListPage } from "./pull-request-link.ts";
import type { PullRequestListSnapshot } from "./pr-list-changes.ts";
import type { WatchedPage } from "./page-reloader.ts";

/** Watches a repository pull request list for added, removed and changed pull requests. */
export function watchPullRequestList(
  client: Pick<AdoClient, "getPullRequests">,
  listPage: PullRequestListPage,
  onScreenPullRequestIds: () => number[],
): WatchedPage<PullRequestListSnapshot> {
  return {
    async fetchSnapshot() {
      const { pullRequests, retryAfterSeconds } = await client.getPullRequests(listPage);
      return { retryAfterSeconds, snapshot: snapshotOf(pullRequests) };
    },
    hasChanged: (loaded, current) => hasListChanged(loaded, current, onScreenPullRequestIds()),
    key: `pull-request-list:${JSON.stringify(listPage)}`,
  };
}
