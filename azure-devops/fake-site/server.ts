// The fake Azure DevOps, on the shared fake-site base. `npm run dev azure-devops` starts it.
// Pages: the board, the repository pull request list, the pull request inbox, a pull
// request, a work item and a pipeline run's views, from the fixtures. Linked work items are invented. API: the GET requests the script sends, answered from the fixtures and
// the state the actions change. Open http://localhost:8787/__dev for links.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { THEME_PATH, themeAction, themeResponse } from "./theme.ts";
import { actions, currentBuilds, currentEvaluations, currentPullRequest } from "./state.ts";
import {
  boardData,
  pageHtml,
  pullRequestDetailData,
  pullRequestDetailPath,
  pullRequestListPath,
  pullRequestPageData,
} from "./data.ts";
import {
  isWorkItemTitleRequest,
  linkedWorkItemsResponse,
  workItemTitlesResponse,
} from "./linked-work-items.ts";
import { jsonResponse, startFakeSite } from "../../shared/dev/fake-site/server.ts";
import { pageAt, pageResponse } from "./page-response.ts";
import { workItemUpdatesResponse, workItemsResponse } from "./board-api.ts";
import { FAKE_SITE_PORT } from "../../build/bundle.ts";
import type { Page } from "./data.ts";
import { reviewerResponse } from "./reviewers.ts";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const BOARD_PATH = "/fake-org/text-2/_boards/board/t/text-3/Stories";
const INBOX_PATH = "/fake-org/_pulls";
const CREATE_PATH = "/fake-org/fake-project/_git/fake-repository/pullrequestcreate";
const WORK_ITEM_PATH = "/fake-org/fake-project/_workitems/edit/1001/";
/** The pull request page that sent an API request: the inbox, or else the repository list. */
function pullRequestPageOf(request: FakeRequest): "pr-list" | "pr-inbox" {
  return request.refererPath?.endsWith("/_pulls") === true ? "pr-inbox" : "pr-list";
}

/** The project id the pull request page's requests use. Its capture keeps no project ids. */
const DETAIL_PROJECT_ID = "00000000-0000-4000-8000-0000000eeeee";

function isFromPullRequestDetail(request: FakeRequest): boolean {
  return /\/pullrequest\/\d+$/u.test(request.refererPath ?? "");
}

function projectResponse(request: FakeRequest, project: string): FakeResponse {
  if (isFromPullRequestDetail(request)) {
    return jsonResponse({ id: DETAIL_PROJECT_ID });
  }
  const id = pullRequestPageData(pullRequestPageOf(request)).meta.projects[project];
  return id === undefined
    ? jsonResponse({ message: `Unknown project ${project}` }, HTTP_NOT_FOUND)
    : jsonResponse({ id });
}

function detailEvaluationsResponse(): FakeResponse {
  const { evaluations } = pullRequestDetailData().data;
  return evaluations.body === null
    ? jsonResponse({ message: "No evaluations" }, evaluations.httpStatus)
    : jsonResponse({ value: evaluations.body.value });
}

function buildsResponse(): FakeResponse {
  const { builds } = pullRequestDetailData().data;
  return builds?.body === null || builds === undefined
    ? jsonResponse({ message: "No runs" }, builds?.httpStatus ?? HTTP_NOT_FOUND)
    : jsonResponse({ count: builds.body.value.length, value: currentBuilds(builds.body.value) });
}

/**
 * One run, with its pipeline, as the run page tabs' switch reads it: the pull request's
 * run with that id, else its first run, as captures of run pages hold no build.
 */
function buildResponse(_request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const runs = (pullRequestDetailData().data.builds?.body?.value ?? []).filter(
    (run): run is { id?: unknown } => typeof run === "object" && run !== null,
  );
  const buildId = Number(match.groups?.buildId ?? "");
  const run = runs.find((candidate) => candidate.id === buildId) ?? runs[0];
  return run === undefined
    ? jsonResponse({ message: `No run ${buildId}` }, HTTP_NOT_FOUND)
    : jsonResponse({ ...run, id: buildId });
}

function timelineResponse(_request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const buildId = match.groups?.buildId ?? "";
  const timeline = pullRequestDetailData().data.timelinesByBuildId?.[buildId];
  if (timeline?.body === null || timeline === undefined) {
    return jsonResponse(
      { message: `No timeline for ${buildId}` },
      timeline?.httpStatus ?? HTTP_NOT_FOUND,
    );
  }
  return jsonResponse(timeline.body);
}

function evaluationsResponse(request: FakeRequest): FakeResponse {
  if (isFromPullRequestDetail(request)) {
    return detailEvaluationsResponse();
  }
  const page = pullRequestPageOf(request);
  const pullRequestId = (request.url.searchParams.get("artifactId") ?? "").split("/").at(-1) ?? "";
  const captured = pullRequestPageData(page).data.evaluationsByPullRequestId[pullRequestId];
  if (captured?.body === null || captured === undefined) {
    return jsonResponse({ message: "No evaluations" }, captured?.httpStatus ?? HTTP_NOT_FOUND);
  }
  return jsonResponse({ value: currentEvaluations(page, pullRequestId, captured.body.value) });
}

function pullRequestsResponse(request: FakeRequest): FakeResponse {
  const isActive = request.url.searchParams.get("searchCriteria.status") === "active";
  const listed = pullRequestPageData("pr-list").data.pullRequests ?? [];
  const value = isActive ? listed.map((pullRequest) => currentPullRequest(pullRequest)) : [];
  return jsonResponse({ count: value.length, value });
}

/** The API paths the script requests, and their answers. */
const API_ROUTES: [RegExp, (request: FakeRequest, match: RegExpExecArray) => FakeResponse][] = [
  [
    /^\/fake-org\/_apis\/projects\/(?<name>[^/]+)$/u,
    (request, match) => projectResponse(request, decodeURIComponent(match.groups?.name ?? "")),
  ],
  [/^\/fake-org\/[^/]+\/_apis\/policy\/evaluations$/u, evaluationsResponse],
  [/^\/fake-org\/[^/]+\/_apis\/build\/builds\/(?<buildId>\d+)\/timeline$/u, timelineResponse],
  [/^\/fake-org\/[^/]+\/_apis\/build\/builds$/u, buildsResponse],
  [/^\/fake-org\/[^/]+\/_apis\/build\/builds\/(?<buildId>\d+)$/u, buildResponse],
  [/^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullrequests$/u, pullRequestsResponse],
  [
    /^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/(?<id>\d+)\/workitems$/u,
    linkedWorkItemsResponse,
  ],
  [
    /^\/fake-org\/_apis\/wit\/workitems$/u,
    (request) =>
      isWorkItemTitleRequest(request)
        ? workItemTitlesResponse(request)
        : workItemsResponse(request),
  ],
  [/^\/fake-org\/_apis\/wit\/workItems\/(?<id>\d+)\/updates$/u, workItemUpdatesResponse],
  [
    /^\/fake-org\/_apis\/connectionData$/u,
    () => jsonResponse({ authenticatedUser: { id: boardData().data.myUserId } }),
  ],
];

function apiResponse(request: FakeRequest): FakeResponse | null {
  const reviewers = reviewerResponse(request);
  if (reviewers !== null || request.method !== "GET") {
    return reviewers;
  }
  for (const [pattern, answer] of API_ROUTES) {
    const match = pattern.exec(request.url.pathname);
    if (match !== null) {
      return answer(request, match);
    }
  }
  return null;
}

const PAGES: Page[] = [
  "board",
  "pr-list",
  "pr-inbox",
  "pr-detail",
  "pr-files",
  "pr-create",
  "pipeline-summary",
  "pipeline-steps",
  "pipeline-log",
  "pipeline-run-tab",
  "work-item",
];

function respond(request: FakeRequest): FakeResponse | null {
  const theme = themeResponse(request);
  if (theme !== null) {
    return theme;
  }
  const fixture = PAGES.find((page) => request.url.pathname === `/fake-site/${page}.html`);
  if (fixture !== undefined) {
    return { body: pageHtml(fixture), contentType: "text/html", status: HTTP_OK };
  }
  const page = pageAt(request.url);
  return page === null ? apiResponse(request) : pageResponse(page);
}

startFakeSite(
  {
    actions: () => [...actions(), themeAction],
    pages: () => [
      { label: "Board", path: BOARD_PATH },
      {
        label: "Pull request list",
        path: pullRequestListPath() ?? "/fake-org/text-2/_git/text-6/pullrequests",
      },
      { label: "Pull request inbox", path: INBOX_PATH },
      {
        label: "Pull request",
        path: pullRequestDetailPath() ?? "/fake-org/text-16/_git/text-17/pullrequest/1003",
      },
      {
        label: "Pull request, Files tab",
        path: `${pullRequestDetailPath() ?? "/fake-org/text-16/_git/text-17/pullrequest/1003"}?_a=files`,
      },
      { label: "New pull request", path: CREATE_PATH },
      { label: "Work item", path: WORK_ITEM_PATH },
      { label: "Theme panel", path: THEME_PATH },
      { label: "Theme panel closed", path: `${THEME_PATH}?panel=closed` },
    ],
    respond,
  },
  FAKE_SITE_PORT,
);
console.log(`Fake Azure DevOps: http://localhost:${FAKE_SITE_PORT}/__dev`);
