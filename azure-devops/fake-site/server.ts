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
const PULL_REQUEST_STYLE = `${BASE_STYLE}
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

/** The API paths the script requests, and their answers. */
const API_ROUTES: [RegExp, (request: FakeRequest, match: RegExpExecArray) => FakeResponse][] = [
  [
    /^\/fake-org\/_apis\/projects\/(?<name>[^/]+)$/u,
    (request, match) => projectResponse(request, decodeURIComponent(match.groups?.name ?? "")),
  ],
  [/^\/fake-org\/[^/]+\/_apis\/policy\/evaluations$/u, evaluationsResponse],
  [/^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullrequests$/u, pullRequestsResponse],
  [/^\/fake-org\/_apis\/wit\/workitems$/u, workItemsResponse],
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
