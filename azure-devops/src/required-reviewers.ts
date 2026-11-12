import type { AdoClient } from "./ado-client.ts";
import type { ListedPullRequest } from "./pr-list-changes.ts";
import type { PullRequestRow } from "./pr-list.ts";
import type { Reviewer } from "./reviewers.ts";
import { createInboxReviewerFetcher } from "./inbox-reviewers.ts";
import { markRequiredReviewers } from "./pr-list.ts";

interface RequiredReviewerMarkerOptions {
  client: Pick<AdoClient, "getPullRequests">;
  now: () => number;
  findRows: () => PullRequestRow[];
}

interface RequiredReviewerMarker {
  /** Marks every row whose reviewers are known. */
  markAll: () => void;
  /** Keeps reviewers that another request already fetched, and marks them. */
  remember: (pullRequests: ListedPullRequest[]) => void;
  /** Fetches the reviewers of the inbox rows when due, and marks them. */
  syncInbox: () => Promise<void>;
}

function createRequiredReviewerMarker(
  options: RequiredReviewerMarkerOptions,
): RequiredReviewerMarker {
  const reviewersByPullRequestId = new Map<number, Reviewer[]>();
  const inboxReviewerFetcher = createInboxReviewerFetcher({
    client: options.client,
    findPullRequests: () => options.findRows().map(({ pullRequest }) => pullRequest),
    now: options.now,
    reviewersByPullRequestId,
  });

  function markAll(): void {
    for (const { row, pullRequest } of options.findRows()) {
      const reviewers = reviewersByPullRequestId.get(pullRequest.pullRequestId);
      if (reviewers) {
        markRequiredReviewers(row, reviewers);
      }
    }
  }

  return {
    markAll,
    remember(pullRequests) {
      for (const pullRequest of pullRequests) {
        reviewersByPullRequestId.set(pullRequest.pullRequestId, pullRequest.reviewers ?? []);
      }
      markAll();
    },
    async syncInbox() {
      await inboxReviewerFetcher.sync();
      markAll();
    },
  };
}

export { createRequiredReviewerMarker };
