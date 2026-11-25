// The pull request list and inbox capture: the rows' policy evaluations, the
// project ids they needed, the pull requests assigned to me and the status colours. Dev file only.
import type { CapturePage, GetOnlyFetch } from "../../../shared/dev/capture/capture.ts";
import type { AdoClient } from "../core/ado-client.ts";
import type { Pseudonyms } from "../../../shared/dev/scrub/pseudonyms.ts";
import type { PullRequestListPage } from "../pull-requests/pull-request-link.ts";
import { apiBasePath } from "../pull-requests/pull-request-link.ts";
import { collectAssignedToMe } from "./capture-assigned-to-me.ts";
import { createAdoClient } from "../core/ado-client.ts";
import { evaluationsOf } from "./capture-pipeline.ts";
import { findPullRequestRows } from "../pull-requests/pr-list.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

const STATUS_COLOR_VARIABLES = [
  "--component-status-success",
  "--component-status-error",
  "--component-status-warning",
  "--component-status-info",
  "--component-status-neutral",
];
const PROJECTS_ROUTE = /\/_apis\/projects\/(?<project>[^/?]+)/u;

function statusColors(): Record<string, string> {
  const style = getComputedStyle(document.body);
  return Object.fromEntries(
    STATUS_COLOR_VARIABLES.map((variable) => [variable, style.getPropertyValue(variable).trim()]),
  );
}

/** A GET-only fetch that also notes each project id the client looks up. */
function recordProjectIds(getOnly: GetOnlyFetch, projectIds: Map<string, string>): GetOnlyFetch {
  return async (url, init) => {
    const response = await getOnly(url, init);
    const project = PROJECTS_ROUTE.exec(url)?.groups?.project;
    if (project !== undefined && response.ok) {
      const body: unknown = await response.clone().json();
      if (
        typeof body === "object" &&
        body !== null &&
        "id" in body &&
        typeof body.id === "string"
      ) {
        projectIds.set(decodeURIComponent(project), body.id);
      }
    }
    return response;
  };
}

/** Policy evaluations of every listed pull request, by stand-in pull request id. */
async function collectEvaluations(
  client: AdoClient,
  basePath: string,
  pseudonyms: Pseudonyms,
): Promise<Record<number, unknown>> {
  const evaluationsByPullRequestId: Record<number, unknown> = {};
  for (const { pullRequest } of findPullRequestRows(document, basePath)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, as the script polls
    const evaluations = await evaluationsOf(client, pullRequest);
    evaluationsByPullRequestId[pseudonyms.number(pullRequest.pullRequestId, "pull request id")] =
      evaluations;
  }
  return evaluationsByPullRequestId;
}

/**
 * The rows' policy evaluations, the project ids they needed, and the status colours.
 * `listPage` also adds the repository's pull request list, as the list check fetches it.
 */
async function collectPullRequestRows(
  fetch: GetOnlyFetch,
  pseudonyms: Pseudonyms,
  listPage: PullRequestListPage | null,
): Promise<{ data: Record<string, unknown>; meta: Record<string, unknown> }> {
  const basePath = apiBasePath(location);
  pseudonyms.text(basePath.replaceAll("/", ""), "organisation");
  const projectIds = new Map<string, string>();
  const client = createAdoClient({
    apiBasePath: basePath,
    fetch: recordProjectIds(fetch, projectIds),
    origin: location.origin,
  });
  const listed = listPage === null ? null : await client.getPullRequests(listPage);
  const evaluationsByPullRequestId = await collectEvaluations(client, basePath, pseudonyms);
  const assignedToMe = await collectAssignedToMe(client, listPage);
  const projects = Object.fromEntries(
    [...projectIds].map(([project, id]) => [
      pseudonyms.text(project, "project"),
      pseudonyms.guid(id, "project id"),
    ]),
  );
  const meta = {
    isLegacyHost: location.hostname !== "dev.azure.com",
    projects,
    statusColors: statusColors(),
  };
  return {
    data:
      listed === null
        ? { assignedToMe, evaluationsByPullRequestId }
        : { assignedToMe, evaluationsByPullRequestId, pullRequests: listed.pullRequests },
    meta,
  };
}

function pullRequestRowsPage(name: string, listPage: PullRequestListPage | null): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      return collectPullRequestRows(fetch, pseudonyms, listPage);
    },
    name,
    // The whole body, so the capture holds Azure DevOps's top bar, where the settings button goes.
    root: withoutScriptMarks(document.body),
    styleRoot: document.body,
  };
}

export { pullRequestRowsPage };
