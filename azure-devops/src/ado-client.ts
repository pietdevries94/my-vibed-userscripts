import type { BoardWorkItem } from "./board.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { ListedPullRequest } from "./pr-list-changes.ts";
import type { PullRequestListPage, PullRequestRef } from "./pull-request-link.ts";

export interface PolicyEvaluationsResponse {
  evaluations: PolicyEvaluation[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

export interface PullRequestsResponse {
  pullRequests: ListedPullRequest[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

export interface WorkItemsResponse {
  workItems: BoardWorkItem[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

/** The work items API accepts at most this many ids per request. */
const MAX_WORK_ITEMS_PER_REQUEST = 200;

/** Enough to detect an added or removed pull request in any realistic list. */
const MAX_LISTED_PULL_REQUESTS = 200;

export interface AdoClient {
  getPolicyEvaluations(pullRequest: PullRequestRef): Promise<PolicyEvaluationsResponse>;
  getPullRequests(listPage: PullRequestListPage): Promise<PullRequestsResponse>;
  getWorkItems(ids: number[]): Promise<WorkItemsResponse>;
  /** The id of the signed-in user, or null when Azure DevOps does not tell. */
  getAuthenticatedUserId(): Promise<string | null>;
}

export class AdoRequestError extends Error {
  readonly httpStatus: number;
  readonly retryAfterSeconds: number | null;

  constructor(httpStatus: number, retryAfterSeconds: number | null) {
    super(`Azure DevOps request failed with HTTP ${httpStatus}`);
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Read-only client. Every request is a GET with the page's session cookie. */
export function createAdoClient(options: { origin: string; apiBasePath: string; fetch: Fetch }): AdoClient {
  const projectIdRequests = new Map<string, Promise<string>>();

  async function getJson(path: string): Promise<{ body: any; retryAfterSeconds: number | null }> {
    const response = await options.fetch(options.origin + options.apiBasePath + path, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const retryAfter = Number(response.headers.get("Retry-After"));
    const retryAfterSeconds = response.headers.has("Retry-After") && Number.isFinite(retryAfter) ? retryAfter : null;
    if (!response.ok) throw new AdoRequestError(response.status, retryAfterSeconds);
    return { body: await response.json(), retryAfterSeconds };
  }

  function getProjectId(project: string): Promise<string> {
    let request = projectIdRequests.get(project);
    if (!request) {
      request = getJson(`/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`).then(({ body }) => body.id as string);
      request.catch(() => projectIdRequests.delete(project));
      projectIdRequests.set(project, request);
    }
    return request;
  }

  let authenticatedUserIdRequest: Promise<string | null> | undefined;

  return {
    async getWorkItems(ids) {
      const workItems: BoardWorkItem[] = [];
      let retryAfterSeconds: number | null = null;
      for (let start = 0; start < ids.length; start += MAX_WORK_ITEMS_PER_REQUEST) {
        const idsInRequest = ids.slice(start, start + MAX_WORK_ITEMS_PER_REQUEST);
        const response = await getJson(
          `/_apis/wit/workitems?ids=${idsInRequest.join(",")}&fields=System.Rev,System.ChangedBy&errorPolicy=Omit&api-version=7.1`,
        );
        retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
        // errorPolicy=Omit gives null for a work item that was deleted or is not readable.
        for (const workItem of response.body.value as any[]) {
          if (workItem) workItems.push({ id: workItem.id, rev: workItem.rev, changedById: workItem.fields?.["System.ChangedBy"]?.id ?? null });
        }
      }
      return { workItems, retryAfterSeconds };
    },

    getAuthenticatedUserId() {
      authenticatedUserIdRequest ??= getJson("/_apis/connectionData")
        .then(({ body }) => (body.authenticatedUser?.id as string | undefined) ?? null)
        .catch(() => null);
      return authenticatedUserIdRequest;
    },

    async getPolicyEvaluations(pullRequest) {
      const projectId = await getProjectId(pullRequest.project);
      const artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequest.pullRequestId}`;
      const { body, retryAfterSeconds } = await getJson(
        `/${projectId}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`,
      );
      return { evaluations: body.value as PolicyEvaluation[], retryAfterSeconds };
    },

    async getPullRequests({ project, repository, status }) {
      const { body, retryAfterSeconds } = await getJson(
        `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests` +
        `?searchCriteria.status=${status}&$top=${MAX_LISTED_PULL_REQUESTS}&api-version=7.1`,
      );
      return { pullRequests: body.value as ListedPullRequest[], retryAfterSeconds };
    },
  };
}
