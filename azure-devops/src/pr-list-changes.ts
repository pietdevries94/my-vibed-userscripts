import type { Reviewer } from "./reviewers.ts";

/** The fields of a pull request that the list page shows. From the Git pull requests REST API. */
export interface ListedPullRequest {
  pullRequestId: number;
  title?: string;
  isDraft?: boolean;
  status?: string;
  targetRefName?: string;
  reviewers?: Reviewer[];
  lastMergeSourceCommit?: { commitId?: string };
  autoCompleteSetBy?: { id?: string };
}

/** What the list showed at one moment: the shown fields of each pull request, by id. */
export type PullRequestListSnapshot = Map<number, string>;

export function snapshotOf(pullRequests: ListedPullRequest[]): PullRequestListSnapshot {
  return new Map(pullRequests.map((pullRequest) => [
    pullRequest.pullRequestId,
    JSON.stringify([
      pullRequest.title,
      pullRequest.isDraft,
      pullRequest.status,
      pullRequest.targetRefName,
      pullRequest.lastMergeSourceCommit?.commitId,
      pullRequest.autoCompleteSetBy?.id,
      (pullRequest.reviewers ?? []).map((reviewer) => `${reviewer.id}:${reviewer.vote}:${reviewer.isRequired ?? false}`).sort(),
    ]),
  ]));
}

/**
 * True when a pull request was added to or removed from the list, or when a
 * pull request on screen changed. Changes to pull requests that are not on
 * screen (another tab's, or below the fold of a long list) do not count.
 */
export function hasListChanged(
  before: PullRequestListSnapshot,
  after: PullRequestListSnapshot,
  onScreenPullRequestIds: Iterable<number>,
): boolean {
  if (before.size !== after.size) return true;
  for (const pullRequestId of before.keys()) {
    if (!after.has(pullRequestId)) return true;
  }
  for (const pullRequestId of onScreenPullRequestIds) {
    if (before.has(pullRequestId) && before.get(pullRequestId) !== after.get(pullRequestId)) return true;
  }
  return false;
}
