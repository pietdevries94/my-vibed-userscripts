// The fake site's pages: which page a URL shows, and its HTML with the site's CSS and the
// fake site's scripts.
import { BOARD_STYLE, FULL_WINDOW_STYLE, PULL_REQUEST_STYLE, RUN_STYLE } from "./styles.ts";
import { pageCss, pullRequestPageData } from "./data.ts";
import { parsePipelineRunLocation, pipelineRunTabOf } from "../src/pipeline/pipeline-run-link.ts";
import { CREATE_PAGE_SCRIPT } from "./create-page.ts";
import type { FakeResponse } from "../../shared/dev/fake-site/server.ts";
import type { Page } from "./data.ts";
import { draftPillScript } from "./state.ts";
import { fixturePage } from "../../shared/dev/fake-site/fixture-page.ts";
import { htmlResponse } from "../../shared/dev/fake-site/server.ts";
import { starredReviewersScript } from "./starred-reviewers.ts";

const RUN_PAGES = {
  log: "pipeline-log",
  steps: "pipeline-steps",
  summary: "pipeline-summary",
} as const;

/** The pages found by path alone, each with the test of its path. */
const PAGE_PATHS: [Page, (pathname: string) => boolean][] = [
  ["pr-detail", (pathname) => /\/_git\/[^/]+\/pullrequest\/\d+$/u.test(pathname)],
  ["pr-list", (pathname) => /\/_git\/[^/]+\/pullrequests$/u.test(pathname)],
  ["pr-create", (pathname) => /\/_git\/[^/]+\/pullrequestcreate$/u.test(pathname)],
  ["pr-inbox", (pathname) => pathname.endsWith("/_pulls")],
  ["board", (pathname) => pathname.includes("/_boards/board/")],
  ["work-item", (pathname) => /\/_workitems\/edit\/\d+\/?$/u.test(pathname)],
];

/** The page at a URL, or null for an API path or an unknown page. */
function pageAt(url: URL): Page | null {
  if (url.pathname.includes("/_apis/")) {
    return null;
  }
  const run = parsePipelineRunLocation(url);
  const tab = pipelineRunTabOf(url);
  if (run !== null) {
    // The Summary, as "results", is the summary capture; any other tab, the tab capture.
    return run.view === "summary" && tab !== null && tab !== "results"
      ? "pipeline-run-tab"
      : RUN_PAGES[run.view];
  }
  const page = PAGE_PATHS.find(([, matches]) => matches(url.pathname))?.[0] ?? null;
  return page === "pr-detail" && url.searchParams.get("_a") === "files" ? "pr-files" : page;
}

function statusColorStyle(page: "pr-list" | "pr-inbox"): string {
  const colors = Object.entries(pullRequestPageData(page).meta.statusColors);
  return `body { ${colors.map(([name, value]) => `${name}: ${value};`).join(" ")} }`;
}

/** The site's CSS from the capture where it saved some, else the fake site's own stand-in. */
function styleOf(page: Page): string {
  const css = pageCss(page);
  const captured = css === null ? null : `${css}\n${FULL_WINDOW_STYLE}`;
  if (page === "pr-list" || page === "pr-inbox") {
    return `${captured ?? PULL_REQUEST_STYLE}\n${statusColorStyle(page)}`;
  }
  if (captured !== null || page === "board") {
    return captured ?? BOARD_STYLE;
  }
  return page.startsWith("pipeline-") ? RUN_STYLE : PULL_REQUEST_STYLE;
}

function pageResponse(page: Page): FakeResponse {
  const style = styleOf(page);
  return htmlResponse(
    fixturePage({
      fixtureUrl: `/fake-site/${page}.html`,
      script: `${starredReviewersScript()}
${page === "pr-create" ? CREATE_PAGE_SCRIPT : draftPillScript(page)}`,
      style,
      title: `Fake Azure DevOps: ${page}`,
    }),
  );
}

export { pageAt, pageResponse };
