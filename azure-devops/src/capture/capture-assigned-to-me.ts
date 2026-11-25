// The pull requests assigned to the signed-in user, with every reviewer's vote, so a
// fixture shows which of them each tab of the "Assigned to me" card lists. Dev file only.
import type { AdoClient } from "../core/ado-client.ts";
import { AdoRequestError } from "../core/ado-request.ts";
import type { PullRequestListPage } from "../pull-requests/pull-request-link.ts";

/** The signed-in user's id and their active pull requests, on this repository list or the inbox. */
async function collectAssignedToMe(
  client: AdoClient,
  listPage: PullRequestListPage | null,
): Promise<Record<string, unknown>> {
  const authenticatedUserId = await client.getAuthenticatedUserId();
  if (authenticatedUserId === null) {
    return { authenticatedUserId };
  }
  try {
    const { pullRequests } = await client.getPullRequestsAssignedTo(authenticatedUserId, listPage);
    return { authenticatedUserId, pullRequests };
  } catch (error) {
    if (error instanceof AdoRequestError) {
      return { authenticatedUserId, httpStatus: error.httpStatus };
    }
    throw error;
  }
}

export { collectAssignedToMe };
