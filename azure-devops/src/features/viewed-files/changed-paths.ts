// The files a pull request changes, from the REST API.
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { ReviewRequests } from "../../pull-requests/review-requests.ts";

/** What the feature asks the REST API. */
type ChangesClient = Pick<ReviewRequests, "getIterationChanges" | "getPullRequestIterationIds">;

/** The files the newest iteration changes. Null when the pull request has no iteration. */
async function loadChangedPaths(
  client: ChangesClient,
  pullRequest: PullRequestRef,
): Promise<string[] | null> {
  const ids = await client.getPullRequestIterationIds(pullRequest);
  if (ids.length === 0) {
    return null;
  }
  const changes = await client.getIterationChanges(pullRequest, Math.max(...ids));
  // A deleted file has no item path; the tree lists it under its path before.
  return changes.flatMap(({ item, originalPath }) => item?.path ?? originalPath ?? []);
}

export { loadChangedPaths };
export type { ChangesClient };
