// The requests for the pull requests assigned to a reviewer, as the "Assigned to me" card lists them.
import type { AdoClientOptions } from "../core/ado-request.ts";
import type { ListedPullRequest } from "../features/reload-on-changes/pr-list-changes.ts";
import { getJson } from "../core/ado-request.ts";

const MAX_ASSIGNED_PULL_REQUESTS = 200;

interface AssignedPullRequestsResponse {
  pullRequests: ListedPullRequest[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface AssignedPullRequestRequests {
  /** Active pull requests with this reviewer, in one repository, or across the organisation when null. */
  getPullRequestsAssignedTo: (
    reviewerId: string,
    repository: { project: string; repository: string } | null,
  ) => Promise<AssignedPullRequestsResponse>;
}

function pullRequestsPath(repository: { project: string; repository: string } | null): string {
  if (repository === null) {
    return "/_apis/git/pullrequests";
  }
  return `/${encodeURIComponent(repository.project)}/_apis/git/repositories/${encodeURIComponent(repository.repository)}/pullrequests`;
}

function createAssignedPullRequestRequests(options: AdoClientOptions): AssignedPullRequestRequests {
  return {
    async getPullRequestsAssignedTo(reviewerId, repository) {
      const { body, retryAfterSeconds } = await getJson(
        options,
        `${pullRequestsPath(repository)}?searchCriteria.reviewerId=${encodeURIComponent(reviewerId)}` +
          `&searchCriteria.status=active&$top=${MAX_ASSIGNED_PULL_REQUESTS}&api-version=7.1`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
      return { pullRequests: body.value as ListedPullRequest[], retryAfterSeconds };
    },
  };
}

export type { AssignedPullRequestRequests, AssignedPullRequestsResponse };
export { createAssignedPullRequestRequests };
