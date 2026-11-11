import { AdoRequestError, type AdoClient } from "./ado-client.ts";
import { isInProgress, pipelineStatusOf, type PipelineStatus } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";

export const IN_PROGRESS_POLL_INTERVAL_MS = 20_000;
export const SETTLED_POLL_INTERVAL_MS = 180_000;
export const FAILED_REQUEST_RETRY_MS = 60_000;

interface PollerOptions<Row> {
  client: AdoClient;
  now: () => number;
  findRows: () => { row: Row; pullRequest: PullRequestRef }[];
  showStatus: (row: Row, pullRequestId: number, status: PipelineStatus | null) => void;
}

interface PolledPullRequest {
  status: PipelineStatus | null;
  hasBeenFetched: boolean;
  nextPollAt: number;
}

/**
 * Keeps the pipeline status of the listed pull requests current.
 * `sync` is cheap and idempotent: call it on DOM changes and on a timer.
 */
export function createPipelineStatusPoller<Row>(options: PollerOptions<Row>) {
  const polledPullRequests = new Map<number, PolledPullRequest>();
  let pausedUntil = 0;
  let isFetching = false;

  function showFetchedStatuses(): void {
    for (const { row, pullRequest } of options.findRows()) {
      const polled = polledPullRequests.get(pullRequest.pullRequestId);
      if (polled?.hasBeenFetched) options.showStatus(row, pullRequest.pullRequestId, polled.status);
    }
  }

  function duePullRequests(): PullRequestRef[] {
    const due = new Map<number, PullRequestRef>();
    for (const { pullRequest } of options.findRows()) {
      const polled = polledPullRequests.get(pullRequest.pullRequestId);
      if (!polled || polled.nextPollAt <= options.now()) due.set(pullRequest.pullRequestId, pullRequest);
    }
    return [...due.values()];
  }

  async function fetchStatus(pullRequest: PullRequestRef): Promise<void> {
    const polled = polledPullRequests.get(pullRequest.pullRequestId)
      ?? { status: null, hasBeenFetched: false, nextPollAt: 0 };
    polledPullRequests.set(pullRequest.pullRequestId, polled);
    let retryAfterSeconds: number | null = null;
    try {
      const response = await options.client.getPolicyEvaluations(pullRequest);
      retryAfterSeconds = response.retryAfterSeconds;
      polled.status = pipelineStatusOf(response.evaluations);
      polled.hasBeenFetched = true;
      polled.nextPollAt = options.now() + (isInProgress(polled.status) ? IN_PROGRESS_POLL_INTERVAL_MS : SETTLED_POLL_INTERVAL_MS);
    } catch (error) {
      if (error instanceof AdoRequestError) retryAfterSeconds = error.retryAfterSeconds;
      polled.nextPollAt = options.now() + FAILED_REQUEST_RETRY_MS;
    }
    if (retryAfterSeconds !== null) pausedUntil = options.now() + retryAfterSeconds * 1000;
  }

  return {
    async sync(): Promise<void> {
      showFetchedStatuses();
      if (isFetching) return;
      isFetching = true;
      try {
        for (const pullRequest of duePullRequests()) {
          if (options.now() < pausedUntil) break;
          await fetchStatus(pullRequest);
          showFetchedStatuses();
        }
      } finally {
        isFetching = false;
      }
    },
  };
}
