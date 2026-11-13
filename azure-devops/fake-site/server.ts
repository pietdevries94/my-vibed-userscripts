// The fake Azure DevOps, on the shared fake-site base. `npm run dev azure-devops` starts it.
// Pages: the board, the repository pull request list, the pull request inbox, a pull
// request and a pipeline run's views, from the fixtures. API: the GET requests the script sends, answered from the fixtures and
// the state the actions change. Open http://localhost:8787/__dev for links.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { actions, currentEvaluations, currentPullRequest, currentWorkItem } from "./state.ts";
import {
  boardData,
  pageHtml,
  pullRequestDetailData,
  pullRequestDetailPath,
  pullRequestListPath,
  pullRequestPageData,
} from "./data.ts";
import { htmlResponse, jsonResponse, startFakeSite } from "../../shared/dev/fake-site/server.ts";
import { FAKE_SITE_PORT } from "../../build/bundle.ts";
import type { Page } from "./data.ts";
import { fixturePage } from "../../shared/dev/fake-site/fixture-page.ts";
import { parsePipelineRunLocation } from "../src/pipeline-run-link.ts";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const BOARD_PATH = "/fake-org/text-2/_boards/board/t/text-3/Stories";
const INBOX_PATH = "/fake-org/_pulls";
const BASE_STYLE = `body { font: 14px system-ui, sans-serif; margin: 16px; }
.flex-row { display: flex; } .flex-column { display: flex; flex-direction: column; }
.flex-center { align-items: center; } .flex-grow { flex-grow: 1; }
.invisible, .visually-hidden, [hidden] { display: none; }
.bolt-coin, .vss-Persona { display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: #bbb; position: relative; }
img { display: none; }`;
/**
 * The few utility and card styles of azure-devops-ui, Azure DevOps's open source
 * components, that the script's copies of its markup use. Values as in its core.css.
 */
const AZURE_DEVOPS_UI_STYLE = `.padding-horizontal-16 { padding-left: 16px; padding-right: 16px; }
.padding-horizontal-20 { padding-left: 20px; padding-right: 20px; }
.padding-vertical-8 { padding-top: 8px; padding-bottom: 8px; }
.padding-vertical-16 { padding-top: 16px; padding-bottom: 16px; }
.rhythm-horizontal-8 > :not(:first-child) { margin-left: 8px; }
.rhythm-vertical-16 > :not(:first-child) { margin-top: 16px; }
.margin-4 { margin: 4px; } .body-s { font-size: 0.75rem; } .body-m { font-size: 0.875rem; }
.monospaced-m { font-family: Menlo, Consolas, Courier New, monospace; font-size: 0.8125rem; }
.separator-line-top { border-top: 1px solid rgb(234, 234, 234); }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bolt-card { border-radius: 4px; overflow: hidden; padding: 20px 0; }
.bolt-card-white { background: #fff; }
.depth-8 { box-shadow: 0 3.2px 7.2px 0 rgba(0, 0, 0, .132), 0 0.6px 1.8px 0 rgba(0, 0, 0, .108); }`;
const PULL_REQUEST_STYLE = `${BASE_STYLE}
${AZURE_DEVOPS_UI_STYLE}
a.bolt-table-row { display: table-row; color: inherit; text-decoration: none; }
td { padding: 8px 4px; border-bottom: 1px solid #ddd; } .secondary-text { color: #666; }
.bolt-pill { border: 1px solid #999; border-radius: 10px; padding: 0 8px; margin-left: 4px; }`;
/** The run page's own layout: the step tree beside the log. */
const RUN_STYLE = `${BASE_STYLE}
.run-logs-view { display: flex; height: 90vh; } .bolt-master-panel { width: 320px; }
.logs-view { flex: 1; background: #1e1e1e; color: #ddd; padding: 8px; }
.bolt-tree-row td { border: 0; padding: 4px; } .bolt-tree-row.selected { background: #e6f0fa; }
[role="button"] { cursor: pointer; }`;
const BOARD_STYLE = `${BASE_STYLE}
.kanban-board-content { display: flex; gap: 8px; align-items: flex-start; }
.wit-card { border: 1px solid #ccc; border-radius: 4px; margin: 4px; padding: 6px; background: #fff; }
nav, header, .region-header, .project-navigation { display: none; }`;

const RUN_PAGES = {
  log: "pipeline-log",
  steps: "pipeline-steps",
  summary: "pipeline-summary",
} as const;

/** The pages found by path alone, each with the test of its path. */
const PAGE_PATHS: [Page, (pathname: string) => boolean][] = [
  ["pr-detail", (pathname) => /\/_git\/[^/]+\/pullrequest\/\d+$/u.test(pathname)],
  ["pr-list", (pathname) => /\/_git\/[^/]+\/pullrequests$/u.test(pathname)],
  ["pr-inbox", (pathname) => pathname.endsWith("/_pulls")],
  ["board", (pathname) => pathname.includes("/_boards/board/")],
];

/** The page at a URL, or null for an API path or an unknown page. */
function pageAt(url: URL): Page | null {
  if (url.pathname.includes("/_apis/")) {
    return null;
  }
  const run = parsePipelineRunLocation(url);
  if (run !== null) {
    return RUN_PAGES[run.view];
  }
  return PAGE_PATHS.find(([, matches]) => matches(url.pathname))?.[0] ?? null;
}

function statusColorStyle(page: "pr-list" | "pr-inbox"): string {
  const colors = Object.entries(pullRequestPageData(page).meta.statusColors);
  return `body { ${colors.map(([name, value]) => `${name}: ${value};`).join(" ")} }`;
}

function styleOf(page: Page): string {
  if (page === "board") {
    return BOARD_STYLE;
  }
  if (page === "pr-list" || page === "pr-inbox") {
    return `${PULL_REQUEST_STYLE}\n${statusColorStyle(page)}`;
  }
  return page === "pr-detail" ? PULL_REQUEST_STYLE : RUN_STYLE;
}

function pageResponse(page: Page): FakeResponse {
  const style = styleOf(page);
  return htmlResponse(
    fixturePage({
      fixtureUrl: `/fake-site/${page}.html`,
      style,
      title: `Fake Azure DevOps: ${page}`,
    }),
  );
}

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
    : jsonResponse({ count: builds.body.value.length, value: builds.body.value });
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

function workItemsResponse(request: FakeRequest): FakeResponse {
  const ids = (request.url.searchParams.get("ids") ?? "").split(",").map(Number);
  const { workItems } = boardData().data;
  const value = ids.map((id) => {
    const workItem = workItems.find((captured) => captured.id === id);
    if (workItem === undefined) {
      return null;
    }
    const { changedById, rev } = currentWorkItem(workItem);
    return { fields: { "System.ChangedBy": { id: changedById }, "System.Rev": rev }, id, rev };
  });
  return jsonResponse({ count: value.length, value });
}

const MS_PER_DAY = 86_400_000;
/** Spreads the cards over 0 to 24 days in their column. */
const DAYS_PER_ID = 7;
const FAKE_DAYS_IN_COLUMN_SPREAD = 25;
const DAYS_BEFORE_MOVE = 3;

/**
 * Captured dates are minutes apart, so the updates are invented: each card was
 * created, then moved to its column a number of days ago that its id decides.
 */
function workItemUpdatesResponse(_request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const id = Number(match.groups?.id);
  const daysInColumn = (id * DAYS_PER_ID) % FAKE_DAYS_IN_COLUMN_SPREAD;
  const movedAt = new Date(Date.now() - daysInColumn * MS_PER_DAY - MS_PER_DAY / 2).toISOString();
  const createdAt = new Date(Date.parse(movedAt) - DAYS_BEFORE_MOVE * MS_PER_DAY).toISOString();
  const value = [
    {
      fields: {
        "System.BoardColumn": { newValue: "text-new" },
        "System.ChangedDate": { newValue: createdAt },
      },
      id: 1,
      rev: 1,
    },
    {
      fields: {
        "System.BoardColumn": { newValue: "text-active", oldValue: "text-new" },
        "System.ChangedDate": { newValue: movedAt, oldValue: createdAt },
      },
      id: 2,
      rev: 2,
    },
  ];
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
  [/^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullrequests$/u, pullRequestsResponse],
  [/^\/fake-org\/_apis\/wit\/workitems$/u, workItemsResponse],
  [/^\/fake-org\/_apis\/wit\/workItems\/(?<id>\d+)\/updates$/u, workItemUpdatesResponse],
  [
    /^\/fake-org\/_apis\/connectionData$/u,
    () => jsonResponse({ authenticatedUser: { id: boardData().data.myUserId } }),
  ],
];

function apiResponse(request: FakeRequest): FakeResponse | null {
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
  "pipeline-summary",
  "pipeline-steps",
  "pipeline-log",
];

function respond(request: FakeRequest): FakeResponse | null {
  const fixture = PAGES.find((page) => request.url.pathname === `/fake-site/${page}.html`);
  if (fixture !== undefined) {
    return { body: pageHtml(fixture), contentType: "text/html", status: HTTP_OK };
  }
  const page = pageAt(request.url);
  return page === null ? apiResponse(request) : pageResponse(page);
}

startFakeSite(
  {
    actions,
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
    ],
    respond,
  },
  FAKE_SITE_PORT,
);
console.log(`Fake Azure DevOps: http://localhost:${FAKE_SITE_PORT}/__dev`);
