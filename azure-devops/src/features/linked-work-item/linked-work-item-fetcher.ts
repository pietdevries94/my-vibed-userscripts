import type { AdoClient } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { LinkedWorkItems } from "./linked-work-item.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";

/** Work items are linked rarely after a pull request is created. */
const LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS = 300_000;

interface LinkedWorkItemFetcherOptions {
  client: Pick<AdoClient, "getPullRequestWorkItemIds" | "getWorkItemTitle">;
  now: () => number;
  findPullRequests: () => PullRequestRef[];
}

interface LinkedWorkItemFetcher {
  /** Null until the first fetch of that pull request. */
  linkedWorkItems: (pullRequestId: number) => LinkedWorkItems | null;
  /** True until the first fetch of that pull request has answered or failed. */
  isLoading: (pullRequestId: number) => boolean;
  /** Fetches the linked work items that are due. Cheap: call it on DOM changes and on a timer. */
  sync: () => Promise<void>;
}

interface FetchedLinkedWorkItems {
  linkedWorkItems: LinkedWorkItems | null;
  nextFetchAt: number;
}

async function fetchLinkedWorkItems(
  client: LinkedWorkItemFetcherOptions["client"],
  pullRequest: PullRequestRef,
): Promise<LinkedWorkItems> {
  const ids = await client.getPullRequestWorkItemIds(pullRequest);
  const [id] = ids;
  const title = ids.length === 1 && id !== undefined ? await client.getWorkItemTitle(id) : null;
  return { ids, title };
}

/** Fetches the linked work items of each pull request in a list, one at a time. */
function createLinkedWorkItemFetcher(options: LinkedWorkItemFetcherOptions): LinkedWorkItemFetcher {
  const fetched = new Map<number, FetchedLinkedWorkItems>();
  let isFetching = false;

  function duePullRequests(): PullRequestRef[] {
    const due = new Map<number, PullRequestRef>();
    for (const pullRequest of options.findPullRequests()) {
      if ((fetched.get(pullRequest.pullRequestId)?.nextFetchAt ?? 0) <= options.now()) {
        due.set(pullRequest.pullRequestId, pullRequest);
      }
    }
    return [...due.values()];
  }

  async function fetchOne(pullRequest: PullRequestRef): Promise<void> {
    const { pullRequestId } = pullRequest;
    try {
      const linkedWorkItems = await fetchLinkedWorkItems(options.client, pullRequest);
      fetched.set(pullRequestId, {
        linkedWorkItems,
        nextFetchAt: options.now() + LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS,
      });
    } catch {
      fetched.set(pullRequestId, {
        linkedWorkItems: fetched.get(pullRequestId)?.linkedWorkItems ?? null,
        nextFetchAt: options.now() + FAILED_REQUEST_RETRY_MS,
      });
    }
  }

  return {
    isLoading: (pullRequestId) => !fetched.has(pullRequestId),
    linkedWorkItems: (pullRequestId) => fetched.get(pullRequestId)?.linkedWorkItems ?? null,
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

export type { LinkedWorkItemFetcher };
export { LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS, createLinkedWorkItemFetcher };
