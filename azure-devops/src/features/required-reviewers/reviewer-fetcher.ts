import type {
  PullRequestListStatus,
  PullRequestRef,
} from "../../pull-requests/pull-request-link.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { Reviewer } from "../../pull-requests/reviewers.ts";

/** Required reviewers change rarely: a policy adds them when the pull request is created or retargeted. */
const REVIEWER_REFRESH_INTERVAL_MS = 120_000;

interface ReviewerFetcherOptions {
  client: Pick<AdoClient, "getPullRequests">;
  now: () => number;
  findPullRequests: () => PullRequestRef[];
  /** "active" on the inbox; the shown status on a repository list. */
  listStatus: () => PullRequestListStatus;
  /** Filled with the reviewers of every pull request in each fetched repository. */
  reviewersByPullRequestId: Map<number, Reviewer[]>;
}

interface ReviewerFetcher {
  sync: () => Promise<void>;
}

const listKey = ({ project, repository }: PullRequestRef, status: PullRequestListStatus): string =>
  JSON.stringify([project, repository, status]);

/** One pull request per repository whose reviewers are due for a fetch. */
function dueRepositories(
  options: ReviewerFetcherOptions,
  nextFetchAtByList: Map<string, number>,
): PullRequestRef[] {
  const status = options.listStatus();
  const due = new Map<string, PullRequestRef>();
  for (const pullRequest of options.findPullRequests()) {
    const key = listKey(pullRequest, status);
    if ((nextFetchAtByList.get(key) ?? 0) <= options.now()) {
      due.set(key, pullRequest);
    }
  }
  return [...due.values()];
}

/**
 * Fetches the reviewers of the listed pull requests, per repository: one on a repository
 * list, several in the inbox. `sync` is cheap: call it on DOM changes and on a timer.
 */
function createReviewerFetcher(options: ReviewerFetcherOptions): ReviewerFetcher {
  const nextFetchAtByList = new Map<string, number>();
  let isFetching = false;

  async function fetchRepository(pullRequest: PullRequestRef): Promise<void> {
    const status = options.listStatus();
    const key = listKey(pullRequest, status);
    try {
      const { pullRequests } = await options.client.getPullRequests({
        project: pullRequest.project,
        repository: pullRequest.repository,
        status,
      });
      for (const listed of pullRequests) {
        options.reviewersByPullRequestId.set(listed.pullRequestId, listed.reviewers ?? []);
      }
      nextFetchAtByList.set(key, options.now() + REVIEWER_REFRESH_INTERVAL_MS);
    } catch {
      nextFetchAtByList.set(key, options.now() + FAILED_REQUEST_RETRY_MS);
    }
  }

  return {
    async sync() {
      if (isFetching) {
        return;
      }
      isFetching = true;
      try {
        for (const pullRequest of dueRepositories(options, nextFetchAtByList)) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, to stay gentle on the API
          await fetchRepository(pullRequest);
        }
      } finally {
        isFetching = false;
      }
    },
  };
}

export type { ReviewerFetcher };
export { REVIEWER_REFRESH_INTERVAL_MS, createReviewerFetcher };
