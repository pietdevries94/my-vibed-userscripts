import type { AdoClient } from "./ado-client.ts";
import type { PullRequestListStatus } from "./pull-request-link.ts";
import type { PullRequestRow } from "./pr-list.ts";
import type { Reviewer } from "./reviewers.ts";
import { createReviewerFetcher } from "./reviewer-fetcher.ts";
import { markRequiredReviewers } from "./pr-list.ts";

interface RequiredReviewerMarkerOptions {
  client: Pick<AdoClient, "getPullRequests">;
  now: () => number;
  findRows: () => PullRequestRow[];
  /** "active" on the inbox; the shown status on a repository list. */
  listStatus: () => PullRequestListStatus;
}

interface RequiredReviewerMarker {
  /** Marks every row whose reviewers are known. */
  markAll: () => void;
  /** Fetches the reviewers of the listed pull requests when due, and marks them. */
  sync: () => Promise<void>;
}

function createRequiredReviewerMarker(
  options: RequiredReviewerMarkerOptions,
): RequiredReviewerMarker {
  const reviewersByPullRequestId = new Map<number, Reviewer[]>();
  const reviewerFetcher = createReviewerFetcher({
    client: options.client,
    findPullRequests: () => options.findRows().map(({ pullRequest }) => pullRequest),
    listStatus: options.listStatus,
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
    async sync() {
      await reviewerFetcher.sync();
      markAll();
    },
  };
}

export { createRequiredReviewerMarker };
