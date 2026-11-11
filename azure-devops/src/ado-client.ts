import type { PullRequestListPage, PullRequestRef } from "./pull-request-link.ts";
import type { BoardWorkItem } from "./board.ts";
import type { ListedPullRequest } from "./pr-list-changes.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";

interface PolicyEvaluationsResponse {
  evaluations: PolicyEvaluation[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface PullRequestsResponse {
  pullRequests: ListedPullRequest[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface WorkItemsResponse {
  workItems: BoardWorkItem[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface AdoClient {
  getPolicyEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluationsResponse>;
  getPullRequests: (listPage: PullRequestListPage) => Promise<PullRequestsResponse>;
  getWorkItems: (ids: number[]) => Promise<WorkItemsResponse>;
  /** The id of the signed-in user, or null when Azure DevOps does not tell. */
  getAuthenticatedUserId: () => Promise<string | null>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface AdoClientOptions {
  origin: string;
  apiBasePath: string;
  fetch: Fetch;
}

/** The fields the client reads from Azure DevOps responses. */
interface ResponseBody {
  id?: string;
  authenticatedUser?: { id?: string };
  value?: unknown[];
}

/** A work item from the work items API. With errorPolicy=Omit, null for one that was deleted or is not readable. */
type WorkItemBody = {
  id: number;
  rev: number;
  fields?: { "System.ChangedBy"?: { id?: string } };
} | null;

interface JsonResponse {
  body: ResponseBody;
  retryAfterSeconds: number | null;
}

/** The work items API accepts at most this many ids per request. */
const MAX_WORK_ITEMS_PER_REQUEST = 200;

/** Enough to detect an added or removed pull request in any realistic list. */
const MAX_LISTED_PULL_REQUESTS = 200;

class AdoRequestError extends Error {
  public readonly httpStatus: number;
  public readonly retryAfterSeconds: number | null;

  public constructor(httpStatus: number, retryAfterSeconds: number | null) {
    super(`Azure DevOps request failed with HTTP ${httpStatus}`);
    this.name = "AdoRequestError";
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfterSecondsOf(response: Response): number | null {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return response.headers.has("Retry-After") && Number.isFinite(retryAfter) ? retryAfter : null;
}

async function getJson(options: AdoClientOptions, path: string): Promise<JsonResponse> {
  const response = await options.fetch(options.origin + options.apiBasePath + path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    method: "GET",
  });
  const retryAfterSeconds = retryAfterSecondsOf(response);
  if (!response.ok) {
    throw new AdoRequestError(response.status, retryAfterSeconds);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted, unchecked, as in the extension
  return { body: (await response.json()) as ResponseBody, retryAfterSeconds };
}

/** Looks up a project id once per project. A failed lookup is retried on the next call. */
function createProjectIdCache(options: AdoClientOptions): (project: string) => Promise<string> {
  const projectIdRequests = new Map<string, Promise<string>>();
  return async (project) => {
    let request = projectIdRequests.get(project);
    if (!request) {
      request = getJson(
        options,
        `/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`,
      ).then(({ body }) => String(body.id));
      request.catch(() => projectIdRequests.delete(project));
      projectIdRequests.set(project, request);
    }
    return request;
  };
}

function toBoardWorkItems(values: unknown[] | undefined): BoardWorkItem[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted, unchecked, as in the extension
  const workItems = values as WorkItemBody[];
  return workItems.flatMap((workItem) =>
    workItem === null
      ? []
      : [
          {
            changedById: workItem.fields?.["System.ChangedBy"]?.id ?? null,
            id: workItem.id,
            rev: workItem.rev,
          },
        ],
  );
}

async function getWorkItems(options: AdoClientOptions, ids: number[]): Promise<WorkItemsResponse> {
  const workItems: BoardWorkItem[] = [];
  let retryAfterSeconds: number | null = null;
  for (let start = 0; start < ids.length; start += MAX_WORK_ITEMS_PER_REQUEST) {
    const idsInRequest = ids.slice(start, start + MAX_WORK_ITEMS_PER_REQUEST);
    // oxlint-disable-next-line eslint/no-await-in-loop -- TODO(lint): batches go one at a time; parallel batches would change the request pattern
    const response = await getJson(
      options,
      `/_apis/wit/workitems?ids=${idsInRequest.join(",")}&fields=System.Rev,System.ChangedBy&errorPolicy=Omit&api-version=7.1`,
    );
    retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
    workItems.push(...toBoardWorkItems(response.body.value));
  }
  return { retryAfterSeconds, workItems };
}

/** Read-only client. Every request is a GET with the page's session cookie. */
function createAdoClient(options: AdoClientOptions): AdoClient {
  const getProjectId = createProjectIdCache(options);
  let authenticatedUserIdRequest: Promise<string | null> | null = null;

  return {
    async getAuthenticatedUserId() {
      authenticatedUserIdRequest ??= getJson(options, "/_apis/connectionData")
        .then(({ body }) => body.authenticatedUser?.id ?? null)
        .catch(() => null);
      return authenticatedUserIdRequest;
    },

    async getPolicyEvaluations(pullRequest) {
      const projectId = await getProjectId(pullRequest.project);
      const artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequest.pullRequestId}`;
      const { body, retryAfterSeconds } = await getJson(
        options,
        `/${projectId}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted, unchecked, as in the extension
      return { evaluations: body.value as PolicyEvaluation[], retryAfterSeconds };
    },

    async getPullRequests({ project, repository, status }) {
      const { body, retryAfterSeconds } = await getJson(
        options,
        `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests` +
          `?searchCriteria.status=${status}&$top=${MAX_LISTED_PULL_REQUESTS}&api-version=7.1`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted, unchecked, as in the extension
      return { pullRequests: body.value as ListedPullRequest[], retryAfterSeconds };
    },

    async getWorkItems(ids) {
      return getWorkItems(options, ids);
    },
  };
}

export type { AdoClient, PolicyEvaluationsResponse, PullRequestsResponse, WorkItemsResponse };
export { AdoRequestError, createAdoClient };
