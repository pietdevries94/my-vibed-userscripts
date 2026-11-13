import type { PullRequestListPage, PullRequestRef } from "./pull-request-link.ts";
import { getJson, sendRequest } from "./ado-request.ts";
import type { AdoClientOptions } from "./ado-request.ts";
import type { BoardWorkItem } from "./board.ts";
import type { ListedPullRequest } from "./pr-list-changes.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestBuild } from "./pipeline-checks.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import type { WorkItemUpdate } from "./days-in-column.ts";

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

interface PullRequestBuildsResponse {
  builds: PullRequestBuild[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface TimelineResponse {
  records: TimelineRecord[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface WorkItemsResponse {
  workItems: BoardWorkItem[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface WorkItemUpdatesResponse {
  /** Oldest first. */
  updates: WorkItemUpdate[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface AdoClient {
  getPolicyEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluationsResponse>;
  getPullRequests: (listPage: PullRequestListPage) => Promise<PullRequestsResponse>;
  /** The pipeline runs of a pull request, newest first. */
  getPullRequestBuilds: (
    project: string,
    pullRequestId: number,
  ) => Promise<PullRequestBuildsResponse>;
  /** The stages, jobs and steps of a pipeline run. */
  getTimeline: (project: string, buildId: number) => Promise<TimelineResponse>;
  getWorkItems: (ids: number[]) => Promise<WorkItemsResponse>;
  /** Every change to one work item, oldest first. */
  getWorkItemUpdates: (id: number) => Promise<WorkItemUpdatesResponse>;
  /** The id of the signed-in user, or null when Azure DevOps does not tell. */
  getAuthenticatedUserId: () => Promise<string | null>;
  /** Cancels a queued or running run. */
  cancelBuild: (project: string, buildId: number) => Promise<void>;
  /** Starts a new run of a build check, as Azure DevOps's own Queue button does. */
  requeuePolicyEvaluation: (project: string, evaluationId: string) => Promise<void>;
}

/** A work item from the work items API. With errorPolicy=Omit, null for one that was deleted or is not readable. */
type WorkItemBody = {
  id: number;
  rev: number;
  fields?: { "System.ChangedBy"?: { id?: string } };
} | null;

/** The work items API accepts at most this many ids per request. */
const MAX_WORK_ITEMS_PER_REQUEST = 200;

/** The updates API returns at most this many updates per request. */
const MAX_UPDATES_PER_REQUEST = 200;

/** The runs of one pull request that the Pipeline tab lists. */
const MAX_PULL_REQUEST_BUILDS = 50;

/** Enough to detect an added or removed pull request in any realistic list. */
const MAX_LISTED_PULL_REQUESTS = 200;

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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
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

async function getWorkItemUpdates(
  options: AdoClientOptions,
  id: number,
): Promise<WorkItemUpdatesResponse> {
  const updates: WorkItemUpdate[] = [];
  let retryAfterSeconds: number | null = null;
  for (let skip = 0; ; skip += MAX_UPDATES_PER_REQUEST) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each page tells whether there is a next one
    const response = await getJson(
      options,
      `/_apis/wit/workItems/${id}/updates?$top=${MAX_UPDATES_PER_REQUEST}&$skip=${skip}&api-version=7.1`,
    );
    retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
    const page = (response.body.value ?? []) as WorkItemUpdate[];
    updates.push(...page);
    if (page.length < MAX_UPDATES_PER_REQUEST) {
      return { retryAfterSeconds, updates };
    }
  }
}

async function getPolicyEvaluations(
  options: AdoClientOptions,
  projectId: string,
  { pullRequestId }: PullRequestRef,
): Promise<PolicyEvaluationsResponse> {
  const artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequestId}`;
  const { body, retryAfterSeconds } = await getJson(
    options,
    `/${projectId}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return { evaluations: body.value as PolicyEvaluation[], retryAfterSeconds };
}

async function cancelBuild(
  options: AdoClientOptions,
  project: string,
  buildId: number,
): Promise<void> {
  await sendRequest(
    options,
    `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`,
    { status: "cancelling" },
  );
}

async function requeuePolicyEvaluation(
  options: AdoClientOptions,
  projectId: string,
  evaluationId: string,
): Promise<void> {
  await sendRequest(
    options,
    `/${projectId}/_apis/policy/evaluations/${encodeURIComponent(evaluationId)}?api-version=7.1-preview.1`,
    { status: "queued" },
  );
}

async function getPullRequestBuilds(
  options: AdoClientOptions,
  { project, pullRequestId }: { project: string; pullRequestId: number },
): Promise<PullRequestBuildsResponse> {
  const branchName = encodeURIComponent(`refs/pull/${pullRequestId}/merge`);
  const { body, retryAfterSeconds } = await getJson(
    options,
    `/${encodeURIComponent(project)}/_apis/build/builds?branchName=${branchName}` +
      `&queryOrder=queueTimeDescending&$top=${MAX_PULL_REQUEST_BUILDS}&api-version=7.1`,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return { builds: (body.value ?? []) as PullRequestBuild[], retryAfterSeconds };
}

/** Client with the page's session cookie. Every request is a GET, but the re-queue of a build check and the cancel of a run. */
function createAdoClient(options: AdoClientOptions): AdoClient {
  const getProjectId = createProjectIdCache(options);
  let authenticatedUserIdRequest: Promise<string | null> | null = null;

  return {
    cancelBuild: async (project, buildId) => cancelBuild(options, project, buildId),

    async getAuthenticatedUserId() {
      authenticatedUserIdRequest ??= getJson(options, "/_apis/connectionData")
        .then(({ body }) => body.authenticatedUser?.id ?? null)
        .catch(() => null);
      return authenticatedUserIdRequest;
    },

    getPolicyEvaluations: async (pullRequest) =>
      getPolicyEvaluations(options, await getProjectId(pullRequest.project), pullRequest),

    getPullRequestBuilds: async (project, pullRequestId) =>
      getPullRequestBuilds(options, { project, pullRequestId }),

    async getPullRequests({ project, repository, status }) {
      const { body, retryAfterSeconds } = await getJson(
        options,
        `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests` +
          `?searchCriteria.status=${status}&$top=${MAX_LISTED_PULL_REQUESTS}&api-version=7.1`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
      return { pullRequests: body.value as ListedPullRequest[], retryAfterSeconds };
    },

    async getTimeline(project, buildId) {
      const { body, retryAfterSeconds } = await getJson(
        options,
        `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}/timeline?api-version=7.1`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
      return { records: (body.records ?? []) as TimelineRecord[], retryAfterSeconds };
    },

    getWorkItemUpdates: async (id) => getWorkItemUpdates(options, id),

    getWorkItems: async (ids) => getWorkItems(options, ids),

    requeuePolicyEvaluation: async (project, evaluationId) =>
      requeuePolicyEvaluation(options, await getProjectId(project), evaluationId),
  };
}

export type {
  AdoClient,
  PolicyEvaluationsResponse,
  PullRequestBuildsResponse,
  PullRequestsResponse,
  TimelineResponse,
  WorkItemUpdatesResponse,
  WorkItemsResponse,
};
export { AdoRequestError } from "./ado-request.ts";
export { createAdoClient };
