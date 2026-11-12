// The Azure DevOps capture: which pages to capture, what to keep, and which GET
// requests to send. Dev file only. The owner reads the keep rules below.
import type {
  CaptureDefinition,
  CapturePage,
  GetOnlyFetch,
} from "../../shared/dev/capture/capture.ts";
import {
  apiBasePath,
  isPullRequestInboxLocation,
  parsePullRequestListLocation,
} from "./pull-request-link.ts";
import { evaluationsOf, pullRequestOrRunPage } from "./capture-pipeline.ts";
import { findBoardCardIds, isBoardLocation } from "./board.ts";
import type { AdoClient } from "./ado-client.ts";
import type { BoardWorkItem } from "./board.ts";
import type { Pseudonyms } from "../../shared/dev/scrub/pseudonyms.ts";
import type { PullRequestListPage } from "./pull-request-link.ts";
import type { ScrubRules } from "../../shared/dev/scrub/rules.ts";
import { createAdoClient } from "./ado-client.ts";
import { fakeLink } from "./capture-links.ts";
import { findPullRequestRows } from "./pr-list.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

const STATUS_COLOR_VARIABLES = [
  "--component-status-success",
  "--component-status-error",
  "--component-status-warning",
  "--component-status-info",
  "--component-status-neutral",
];
/** The days in column feature reads the updates of each card. A few show their shape: the most changed ones, which most likely moved. */
const CARDS_WITH_CAPTURED_UPDATES = 5;
const PROJECTS_ROUTE = /\/_apis\/projects\/(?<project>[^/?]+)/u;

const rules: ScrubRules = {
  // Azure DevOps's own layout and state attributes. Their values are fixed words.
  keepAttributes: [
    "aria-roledescription",
    "data-componentregion",
    "data-done",
    "data-is-focusable",
    "data-noclose",
    "data-renderedregion",
    "data-side",
  ],
  keepIdPatterns: [/^__bolt-[\w-]+$/u],
  keepJsonPaths: [
    // Policy evaluation and pull request states: "approved", "running", "active".
    { path: /(?:^|\.)status$/u, value: /^[A-Za-z]{1,30}$/u },
    // The policy type tells build validation from other policies.
    { path: /configuration\.type\.id$/u, value: /^[\da-f-]{36}$/iu },
    { path: /configuration\.type\.displayName$/u, value: /^[\w ]{1,60}$/u },
    // Reviewer votes: -10, -5, 0, 5, 10.
    { path: /(?:^|\.)vote$/u, value: /^-?\d{1,2}$/u },
    // Run timeline records: Stage, Job or Task; pending or completed; succeeded or failed.
    { path: /records\.(?:type|state|result)$/u, value: /^[A-Za-z.]{1,40}$/u },
    // A run's result: succeeded, partiallySucceeded, failed or canceled.
    { path: /(?:^|\.)builds\.body\.value\.result$/u, value: /^[A-Za-z]{1,30}$/u },
    // The order of a record within its parent. A stand-in would lose it.
    { path: /records\.order$/u, value: /^\d{1,4}$/u },
    // Counts the Pipeline tab notes in the script log.
    { path: /(?:^|\.)(?:checkCount|runCount)$/u, value: /^\d{1,4}$/u },
    // Response status, Retry-After and work item revisions.
    { path: /(?:^|\.)(?:httpStatus|retryAfterSeconds|rev)$/u, value: /^\d{1,6}$/u },
  ],
  keepRouteWords: ["edit", "board", "backlog", "t", "results", "pullrequest", "pullrequests"],
  keepUiWords: [
    "Active",
    "Draft",
    // Pull request tabs.
    "Overview",
    "Files",
    "Updates",
    "Commits",
    // Pipeline run tabs and sections.
    "Summary",
    "Logs",
    "Tests",
    "Stages",
    "Jobs",
  ],
  mapUrl: fakeLink,
};

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
        ? { evaluationsByPullRequestId }
        : { evaluationsByPullRequestId, pullRequests: listed.pullRequests },
    meta,
  };
}

function pullRequestRowsPage(name: string, listPage: PullRequestListPage | null): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      return collectPullRequestRows(fetch, pseudonyms, listPage);
    },
    name,
    root: withoutScriptMarks(document.querySelector(".page-content") ?? document.body),
  };
}

/** The updates of the most changed cards, by stand-in work item id. */
async function collectUpdates(
  client: AdoClient,
  workItems: BoardWorkItem[],
  pseudonyms: Pseudonyms,
): Promise<Record<number, unknown>> {
  const updatesByWorkItemId: Record<number, unknown> = {};
  const mostChanged = workItems
    .toSorted((left, right) => right.rev - left.rev)
    .slice(0, CARDS_WITH_CAPTURED_UPDATES);
  for (const { id } of mostChanged) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one card at a time, as the script fetches them
    const { updates } = await client.getWorkItemUpdates(id);
    updatesByWorkItemId[pseudonyms.number(id, "work item id")] = updates;
  }
  return updatesByWorkItemId;
}

function boardPage(): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      const basePath = apiBasePath(location);
      pseudonyms.text(basePath.replaceAll("/", ""), "organisation");
      const client = createAdoClient({ apiBasePath: basePath, fetch, origin: location.origin });
      const cardIds = findBoardCardIds(document);
      const { workItems } = await client.getWorkItems(cardIds);
      const myUserId = await client.getAuthenticatedUserId();
      const updatesByWorkItemId = await collectUpdates(client, workItems, pseudonyms);
      return {
        data: { myUserId, updatesByWorkItemId, workItems },
        meta: {},
      };
    },
    name: "board",
    root: withoutScriptMarks(document.body),
  };
}

function capturePage(document: Document, location: Location): CapturePage | null {
  const listPage = parsePullRequestListLocation(location, apiBasePath(location));
  if (listPage !== null) {
    return pullRequestRowsPage("pr-list", listPage);
  }
  if (isPullRequestInboxLocation(location)) {
    return pullRequestRowsPage("pr-inbox", null);
  }
  return isBoardLocation(location) ? boardPage() : pullRequestOrRunPage(location);
}

const captureDefinition: CaptureDefinition = {
  page: capturePage,
  rules,
  scriptId: "azure-devops",
};

export { captureDefinition };
