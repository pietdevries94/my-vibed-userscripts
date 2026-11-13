import type { PipelineStatus, PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import { isInProgress, pipelineStatusOf } from "../../pipeline/pipeline-status.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";

const IN_PROGRESS_POLL_INTERVAL_MS = 20_000;
const SETTLED_POLL_INTERVAL_MS = 180_000;
const FAILED_REQUEST_RETRY_MS = 60_000;
const MS_PER_SECOND = 1000;

interface PollerOptions<Row> {
  client: AdoClient;
  now: () => number;
  findRows: () => { row: Row; pullRequest: PullRequestRef }[];
  showStatus: (row: Row, pullRequestId: number, status: PipelineStatus | null) => void;
}

interface PipelineStatusPoller {
  sync: () => Promise<void>;
}

interface PolledPullRequest {
  status: PipelineStatus | null;
  hasBeenFetched: boolean;
  nextPollAt: number;
}

interface PollerState<Row> {
  options: PollerOptions<Row>;
  polledPullRequests: Map<number, PolledPullRequest>;
  pausedUntil: number;
  isFetching: boolean;
}

function showFetchedStatuses<Row>(state: PollerState<Row>): void {
  for (const { row, pullRequest } of state.options.findRows()) {
    const polled = state.polledPullRequests.get(pullRequest.pullRequestId);
    if (polled?.hasBeenFetched === true) {
      state.options.showStatus(row, pullRequest.pullRequestId, polled.status);
    }
  }
}

function duePullRequests<Row>(state: PollerState<Row>): PullRequestRef[] {
  const due = new Map<number, PullRequestRef>();
  for (const { pullRequest } of state.options.findRows()) {
    const polled = state.polledPullRequests.get(pullRequest.pullRequestId);
    if (!polled || polled.nextPollAt <= state.options.now()) {
      due.set(pullRequest.pullRequestId, pullRequest);
    }
  }
  return [...due.values()];
}

function recordStatus<Row>(
  state: PollerState<Row>,
  polled: PolledPullRequest,
  evaluations: PolicyEvaluation[],
): void {
  polled.status = pipelineStatusOf(evaluations);
  polled.hasBeenFetched = true;
  const interval = isInProgress(polled.status)
    ? IN_PROGRESS_POLL_INTERVAL_MS
    : SETTLED_POLL_INTERVAL_MS;
  polled.nextPollAt = state.options.now() + interval;
}

/** Fetches one status. Gives the Retry-After that Azure DevOps sent, if any. */
async function fetchAndRecordStatus<Row>(
  state: PollerState<Row>,
  pullRequest: PullRequestRef,
  polled: PolledPullRequest,
): Promise<number | null> {
  let retryAfterSeconds: number | null = null;
  try {
    const response = await state.options.client.getPolicyEvaluations(pullRequest);
    ({ retryAfterSeconds } = response);
    recordStatus(state, polled, response.evaluations);
  } catch (error) {
    if (error instanceof AdoRequestError) {
      ({ retryAfterSeconds } = error);
    }
    polled.nextPollAt = state.options.now() + FAILED_REQUEST_RETRY_MS;
  }
  return retryAfterSeconds;
}

async function fetchStatus<Row>(
  state: PollerState<Row>,
  pullRequest: PullRequestRef,
): Promise<void> {
  const polled = state.polledPullRequests.get(pullRequest.pullRequestId) ?? {
    hasBeenFetched: false,
    nextPollAt: 0,
    status: null,
  };
  state.polledPullRequests.set(pullRequest.pullRequestId, polled);
  const retryAfterSeconds = await fetchAndRecordStatus(state, pullRequest, polled);
  if (retryAfterSeconds !== null) {
    state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND;
  }
}

async function fetchDueStatuses<Row>(state: PollerState<Row>): Promise<void> {
  for (const pullRequest of duePullRequests(state)) {
    if (state.options.now() < state.pausedUntil) {
      break;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- TODO(lint): one request at a time, so Retry-After can pause the rest; parallel requests would change that
    await fetchStatus(state, pullRequest);
    showFetchedStatuses(state);
  }
}

/**
 * Keeps the pipeline status of the listed pull requests current.
 * `sync` is cheap and idempotent: call it on DOM changes and on a timer.
 */
function createPipelineStatusPoller<Row>(options: PollerOptions<Row>): PipelineStatusPoller {
  const state: PollerState<Row> = {
    isFetching: false,
    options,
    pausedUntil: 0,
    polledPullRequests: new Map(),
  };
  return {
    async sync() {
      showFetchedStatuses(state);
      if (state.isFetching) {
        return;
      }
      state.isFetching = true;
      try {
        await fetchDueStatuses(state);
      } finally {
        state.isFetching = false;
      }
    },
  };
}

export type { PipelineStatusPoller };
export {
  FAILED_REQUEST_RETRY_MS,
  IN_PROGRESS_POLL_INTERVAL_MS,
  SETTLED_POLL_INTERVAL_MS,
  createPipelineStatusPoller,
};
