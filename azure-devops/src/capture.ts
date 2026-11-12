// The Azure DevOps capture: which pages to capture, what to keep, and which GET
// requests to send. Dev file only. The owner reads the keep rules below.
import { AdoRequestError, createAdoClient } from "./ado-client.ts";
import type { CapturePage, GetOnlyFetch } from "../../shared/dev/capture/capture.ts";
import type { PullRequestListPage, PullRequestRef } from "./pull-request-link.ts";
import {
  apiBasePath,
  isPullRequestInboxLocation,
  parsePullRequestHref,
  parsePullRequestListLocation,
} from "./pull-request-link.ts";
import { findBoardCardIds, isBoardLocation } from "./board.ts";
import type { AdoClient } from "./ado-client.ts";
import { PIPELINE_STATUS_ICON_CLASS } from "./pipeline-status-icon.ts";
import type { Pseudonyms } from "../../shared/dev/scrub/pseudonyms.ts";
import type { ScrubRules } from "../../shared/dev/scrub/rules.ts";
import { findPullRequestRows } from "./pr-list.ts";
import { registerCapture } from "../../shared/dev/capture/capture.ts";

/** The organisation in every fake URL. */
const FAKE_ORGANISATION = "fake-org";
const STATUS_COLOR_VARIABLES = [
  "--component-status-success",
  "--component-status-error",
  "--component-status-warning",
  "--component-status-info",
  "--component-status-neutral",
];
const PROJECTS_ROUTE = /\/_apis\/projects\/(?<project>[^/?]+)/u;

function fakePullRequestLink(url: URL, pseudonyms: Pseudonyms): string | null {
  const pullRequest = parsePullRequestHref(url.pathname, apiBasePath(location));
  if (pullRequest === null) {
    return null;
  }
  const project = pseudonyms.text(pullRequest.project, "pull request link project");
  const repository = pseudonyms.text(pullRequest.repository, "pull request link repository");
  const pullRequestId = pseudonyms.number(pullRequest.pullRequestId, "pull request link id");
  return `/${FAKE_ORGANISATION}/${project}/_git/${repository}/pullrequest/${pullRequestId}`;
}

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
    // Response status, Retry-After and work item revisions.
    { path: /(?:^|\.)(?:httpStatus|retryAfterSeconds|rev)$/u, value: /^\d{1,6}$/u },
  ],
  keepRouteWords: ["edit", "board", "backlog", "t", "results", "pullrequest", "pullrequests"],
  keepUiWords: ["Active", "Draft"],
  mapUrl: fakePullRequestLink,
};

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function hasInlineStyle(element: Element): element is Element & ElementCSSInlineStyle {
  return "style" in element;
}

/**
 * A copy of `root` without what this script added: status icons, data-fix-ado-*
 * attributes and --fix-ado-* style properties. The fixture shows the page as
 * Azure DevOps rendered it.
 */
function withoutScriptMarks(root: Element): Element {
  const copy = root.cloneNode(true);
  if (!isElement(copy)) {
    return root;
  }
  for (const icon of copy.querySelectorAll(`.${PIPELINE_STATUS_ICON_CLASS}`)) {
    icon.remove();
  }
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    removeScriptMarks(element);
  }
  return copy;
}

function removeScriptMarks(element: Element): void {
  for (const name of element
    .getAttributeNames()
    .filter((attribute) => attribute.startsWith("data-fix-ado-"))) {
    element.removeAttribute(name);
  }
  if (hasInlineStyle(element)) {
    for (const property of [...element.style].filter((name) => name.startsWith("--fix-ado-"))) {
      element.style.removeProperty(property);
    }
    if (element.getAttribute("style") === "") {
      element.removeAttribute("style");
    }
  }
}

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

async function evaluationsOf(client: AdoClient, pullRequest: PullRequestRef): Promise<unknown> {
  try {
    const { evaluations, retryAfterSeconds } = await client.getPolicyEvaluations(pullRequest);
    return { body: { value: evaluations }, httpStatus: 200, retryAfterSeconds };
  } catch (error) {
    return error instanceof AdoRequestError
      ? { body: null, httpStatus: error.httpStatus, retryAfterSeconds: error.retryAfterSeconds }
      : { body: null, httpStatus: 0, retryAfterSeconds: null };
  }
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

function boardPage(): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      const basePath = apiBasePath(location);
      pseudonyms.text(basePath.replaceAll("/", ""), "organisation");
      const client = createAdoClient({ apiBasePath: basePath, fetch, origin: location.origin });
      const cardIds = findBoardCardIds(document);
      const { workItems } = await client.getWorkItems(cardIds);
      const myUserId = await client.getAuthenticatedUserId();
      return {
        data: { myUserId, workItems },
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
  return isBoardLocation(location) ? boardPage() : null;
}

registerCapture({ page: capturePage, rules, scriptId: "azure-devops" });
