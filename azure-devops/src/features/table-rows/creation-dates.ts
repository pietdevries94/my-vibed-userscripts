// When each listed pull request was created, for the table's age column. Azure DevOps's row says
// so only until the pull request is updated, so the table fetches the others. A creation date
// never changes, so each one is fetched once.

import type { AdoClient } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";

interface CreationDatesOptions {
  client: Pick<AdoClient, "getPullRequestCreationDate">;
  now: () => number;
}

interface CreationDates {
  /** Epoch ms, or null while unknown. */
  createdAt: (pullRequestId: number) => number | null;
  /** Fetches the dates of these pull requests that are still unknown, one at a time. */
  sync: (pullRequests: PullRequestRef[]) => Promise<void>;
}

function createCreationDates({ client, now }: CreationDatesOptions): CreationDates {
  const fetched = new Map<number, number>();
  /** When to try a failed request again, by pull request id. */
  const retryAt = new Map<number, number>();
  let isFetching = false;

  async function fetchOne(pullRequest: PullRequestRef): Promise<void> {
    try {
      fetched.set(
        pullRequest.pullRequestId,
        Date.parse(await client.getPullRequestCreationDate(pullRequest)),
      );
      retryAt.delete(pullRequest.pullRequestId);
    } catch {
      retryAt.set(pullRequest.pullRequestId, now() + FAILED_REQUEST_RETRY_MS);
    }
  }

  const isDue = ({ pullRequestId }: PullRequestRef): boolean =>
    !fetched.has(pullRequestId) && (retryAt.get(pullRequestId) ?? 0) <= now();

  return {
    createdAt: (pullRequestId) => fetched.get(pullRequestId) ?? null,
    async sync(pullRequests) {
      if (isFetching) {
        return;
      }
      isFetching = true;
      try {
        for (const pullRequest of pullRequests.filter((listed) => isDue(listed))) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, to stay gentle on the API
          await fetchOne(pullRequest);
        }
      } finally {
        isFetching = false;
      }
    },
  };
}

export type { CreationDates };
export { createCreationDates };
