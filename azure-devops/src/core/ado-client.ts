import type { PullRequestListPage, PullRequestRef } from "../pull-requests/pull-request-link.ts";
import { getJson, sendRequest } from "./ado-request.ts";
import type { AdoClientOptions } from "./ado-request.ts";
import type { BuildRequests } from "../pipeline/build-requests.ts";
import type { Identity } from "../pull-requests/reviewer-requests.ts";
import type { ListedPullRequest } from "../features/reload-on-changes/pr-list-changes.ts";
import type { PolicyEvaluation } from "../pipeline/pipeline-status.ts";
import type { ReviewRequests } from "../pull-requests/review-requests.ts";
import type { TimelineRecord } from "../pipeline/pipeline-timeline.ts";
import type { WorkItemRequests } from "./work-item-requests.ts";
import { createBuildRequests } from "../pipeline/build-requests.ts";
import { createReviewRequests } from "../pull-requests/review-requests.ts";
import { createReviewerRequests } from "../pull-requests/reviewer-requests.ts";
import { createWorkItemRequests } from "./work-item-requests.ts";

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

interface TimelineResponse {
  records: TimelineRecord[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface AdoClient extends ReviewRequests, BuildRequests, WorkItemRequests {
  getPolicyEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluationsResponse>;
  getPullRequests: (listPage: PullRequestListPage) => Promise<PullRequestsResponse>;
  /** The stages, jobs and steps of a pipeline run. */
  getTimeline: (project: string, buildId: number) => Promise<TimelineResponse>;
  /** The id of the signed-in user, or null when Azure DevOps does not tell. */
  getAuthenticatedUserId: () => Promise<string | null>;
  /** Cancels a queued or running run. */
  cancelBuild: (project: string, buildId: number) => Promise<void>;
  /** Saves the theme Azure DevOps shows the signed-in user, such as `ms.vss-web.vsts-theme-dark`. */
  saveTheme: (themeId: string) => Promise<void>;
  /** Starts a new run of a build check, as Azure DevOps's own Queue button does. */
  requeuePolicyEvaluation: (project: string, evaluationId: string) => Promise<void>;
  getPullRequestReviewers: (pullRequest: PullRequestRef) => Promise<Identity[]>;
  addPullRequestReviewer: (
    pullRequest: PullRequestRef,
    reviewer: { reviewerId: string; isRequired: boolean },
  ) => Promise<void>;
  /** People and groups whose name or address matches the query. */
  searchIdentities: (query: string) => Promise<Identity[]>;
}

/** Enough to detect an added or removed pull request in any realistic list. */
const MAX_LISTED_PULL_REQUESTS = 200;
const THEME_SETTING_KEY = "WebPlatform/Theme";

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
    { body: { status: "cancelling" }, method: "PATCH" },
  );
}

/** The theme lives in the user's global settings, where Azure DevOps's own theme panel saves it. */
async function saveTheme(options: AdoClientOptions, themeId: string): Promise<void> {
  await sendRequest(options, "/_apis/Settings/Entries/globalme?api-version=7.1-preview.1", {
    body: { [THEME_SETTING_KEY]: themeId },
    method: "PATCH",
  });
}

async function requeuePolicyEvaluation(
  options: AdoClientOptions,
  projectId: string,
  evaluationId: string,
): Promise<void> {
  await sendRequest(
    options,
    `/${projectId}/_apis/policy/evaluations/${encodeURIComponent(evaluationId)}?api-version=7.1-preview.1`,
    { body: { status: "queued" }, method: "PATCH" },
  );
}

/**
 * Client with the page's session cookie. Every request is a GET, but the re-queue of a
 * build check, the cancel of a run, saving the theme, adding a reviewer, the identity search,
 * and a review's threads and vote.
 */
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

    requeuePolicyEvaluation: async (project, evaluationId) =>
      requeuePolicyEvaluation(options, await getProjectId(project), evaluationId),
    saveTheme: async (themeId) => saveTheme(options, themeId),

    ...createBuildRequests(options),
    ...createReviewRequests(options),
    ...createWorkItemRequests(options),
    ...createReviewerRequests(options),
  };
}

export type { AdoClient, PolicyEvaluationsResponse, PullRequestsResponse, TimelineResponse };
export type { WorkItemUpdatesResponse, WorkItemsResponse } from "./work-item-requests.ts";
export { AdoRequestError } from "./ado-request.ts";
export { createAdoClient };
