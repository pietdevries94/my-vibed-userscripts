import type { AdoClient } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import { publishedAt } from "./published-since.ts";

/**
 * A publish time changes only when a pull request goes to draft and back, which the
 * Draft pill shows at once. The refresh catches a round trip between two syncs.
 */
const PUBLISHED_AT_REFRESH_INTERVAL_MS = 600_000;

interface RowDraftState {
  pullRequest: PullRequestRef;
  isDraft: boolean;
}

interface PublishedAtFetcherOptions {
  client: Pick<AdoClient, "getPullRequestCreationDate" | "getPullRequestThreads">;
  now: () => number;
  findRows: () => RowDraftState[];
}

interface PublishedAtFetcher {
  /** Epoch ms, or null while unknown or in draft. */
  publishedAt: (pullRequestId: number) => number | null;
  /** Fetches the publish times that are due. Cheap: call it on DOM changes and on a timer. */
  sync: () => Promise<void>;
}

interface FetchedPublishedAt {
  publishedAt: number | null;
  nextFetchAt: number;
}

async function fetchPublishedAt(
  client: PublishedAtFetcherOptions["client"],
  pullRequest: PullRequestRef,
): Promise<number> {
  const threads = await client.getPullRequestThreads(pullRequest);
  const hasDraftUpdate = threads.some(
    (thread) => thread.properties?.CodeReviewThreadType?.$value === "IsDraftUpdate",
  );
  const creationDate = hasDraftUpdate ? "" : await client.getPullRequestCreationDate(pullRequest);
  return publishedAt(creationDate, threads);
}

/** Fetches the publish time of each published pull request in a list, one at a time. */
function createPublishedAtFetcher(options: PublishedAtFetcherOptions): PublishedAtFetcher {
  const fetched = new Map<number, FetchedPublishedAt>();
  let isFetching = false;

  function duePullRequests(): PullRequestRef[] {
    const due = new Map<number, PullRequestRef>();
    for (const { pullRequest, isDraft } of options.findRows()) {
      if (isDraft) {
        fetched.delete(pullRequest.pullRequestId);
      } else if ((fetched.get(pullRequest.pullRequestId)?.nextFetchAt ?? 0) <= options.now()) {
        due.set(pullRequest.pullRequestId, pullRequest);
      }
    }
    return [...due.values()];
  }

  async function fetchOne(pullRequest: PullRequestRef): Promise<void> {
    const { pullRequestId } = pullRequest;
    try {
      const at = await fetchPublishedAt(options.client, pullRequest);
      fetched.set(pullRequestId, {
        nextFetchAt: options.now() + PUBLISHED_AT_REFRESH_INTERVAL_MS,
        publishedAt: at,
      });
    } catch {
      fetched.set(pullRequestId, {
        nextFetchAt: options.now() + FAILED_REQUEST_RETRY_MS,
        publishedAt: fetched.get(pullRequestId)?.publishedAt ?? null,
      });
    }
  }

  return {
    publishedAt: (pullRequestId) => fetched.get(pullRequestId)?.publishedAt ?? null,
    async sync() {
      if (isFetching) {
        return;
      }
      isFetching = true;
      try {
        for (const pullRequest of duePullRequests()) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, to stay gentle on the API
          await fetchOne(pullRequest);
        }
      } finally {
        isFetching = false;
      }
    },
  };
}

export type { PublishedAtFetcher };
export { PUBLISHED_AT_REFRESH_INTERVAL_MS, createPublishedAtFetcher };
