import type { AdoClient } from "./ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "./pipeline-status-poller.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { Reviewer } from "./reviewers.ts";

/** Required reviewers change rarely: a policy adds them when the pull request is created or retargeted. */
const REVIEWER_REFRESH_INTERVAL_MS = 120_000;

interface InboxReviewerFetcherOptions {
  client: Pick<AdoClient, "getPullRequests">;
  now: () => number;
  findPullRequests: () => PullRequestRef[];
  /** Filled with the reviewers of every pull request in each fetched repository. */
  reviewersByPullRequestId: Map<number, Reviewer[]>;
}

interface InboxReviewerFetcher {
  sync: () => Promise<void>;
}

const repositoryKey = ({ project, repository }: PullRequestRef): string =>
  JSON.stringify([project, repository]);

/** One pull request per repository whose reviewers are due for a fetch. */
function dueRepositories(
  options: InboxReviewerFetcherOptions,
  nextFetchAtByRepository: Map<string, number>,
): PullRequestRef[] {
  const due = new Map<string, PullRequestRef>();
  for (const pullRequest of options.findPullRequests()) {
    const key = repositoryKey(pullRequest);
    if ((nextFetchAtByRepository.get(key) ?? 0) <= options.now()) {
      due.set(key, pullRequest);
    }
  }
  return [...due.values()];
}

/**
 * Fetches the reviewers of the pull requests in the inbox, which spans repositories.
 * The inbox page itself does not fetch them. `sync` is cheap: call it on DOM changes and on a timer.
 */
function createInboxReviewerFetcher(options: InboxReviewerFetcherOptions): InboxReviewerFetcher {
  const nextFetchAtByRepository = new Map<string, number>();
  let isFetching = false;

  async function fetchRepository(pullRequest: PullRequestRef): Promise<void> {
    const key = repositoryKey(pullRequest);
    try {
      const { pullRequests } = await options.client.getPullRequests({
        project: pullRequest.project,
        repository: pullRequest.repository,
        status: "active",
      });
      for (const listed of pullRequests) {
        options.reviewersByPullRequestId.set(listed.pullRequestId, listed.reviewers ?? []);
      }
      nextFetchAtByRepository.set(key, options.now() + REVIEWER_REFRESH_INTERVAL_MS);
    } catch {
      nextFetchAtByRepository.set(key, options.now() + FAILED_REQUEST_RETRY_MS);
    }
  }

  return {
    async sync() {
      if (isFetching) {
        return;
      }
      isFetching = true;
      try {
        for (const pullRequest of dueRepositories(options, nextFetchAtByRepository)) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, to stay gentle on the API
          await fetchRepository(pullRequest);
        }
      } finally {
        isFetching = false;
      }
    },
  };
}

export type { InboxReviewerFetcher };
export { REVIEWER_REFRESH_INTERVAL_MS, createInboxReviewerFetcher };
