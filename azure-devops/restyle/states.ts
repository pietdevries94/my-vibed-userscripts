// Windows 98 mode's restyle: each state with its artboard, the failure-count checks, and the pages
// the audit opens. Run with `npm run restyle:diff azure-devops` and `npm run restyle:audit
// azure-devops`; see the restyle skill. Dev file only.
import type { DiffState, RestyleConfig } from "../../shared/dev/restyle/restyle-config.ts";
import {
  LONG_LINE,
  MANY_LINES,
  boardWidth,
  dropDownVariants,
  issueBoxOverflow,
  setIssueMessage,
} from "./checks.ts";
import { threadHeaders, threadStates } from "./threads.ts";
import type { Page } from "playwright";
import { REPO_ROOT } from "../../build/scripts.ts";
import fs from "node:fs";
import path from "node:path";
import { treeScroll } from "./files.ts";

const PR = "/fake-org/text-15/_git/text-16/pullrequest";
const LIST = "/fake-org/text-2/_git/text-16/pullrequests";
const BOARD = "/fake-org/text-2/_boards/board/t/text-3/Stories";
const RUN = "/fake-org/text-2/_build/results?buildId=1001";
const FIXTURES = path.join(REPO_ROOT, "azure-devops", "fixtures");

/** Font icons and images: the artboards draw their boxes, not their glyphs. */
const SITE_MASK =
  'img, .fabric-icon, [class*="ms-Icon"], .commandbar-icon:not(.me-control-div), [class*="bowtie"], .fix-ado-settings-button svg, .bolt-coin-content.using-image, .repos-merge-animation svg, .codicon { visibility: hidden !important; }';
/** Status icons and other SVGs too, on pages whose artboards draw them as glyph boxes. */
const SVG_MASK = ".bolt-status, svg { visibility: hidden !important; }";

/** A tooltip in Azure DevOps' portal, invented: no capture has one open. */
async function showTooltip(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (!document.querySelector(".bolt-portal-host")) {
      document.body.append(
        Object.assign(document.createElement("div"), {
          className: "bolt-portal-host absolute-fill no-events scroll-hidden",
        }),
      );
    }
    document
      .querySelector(".bolt-portal-host")
      ?.insertAdjacentHTML(
        "beforeend",
        '<div class="bolt-portal absolute-fill"><div class="bolt-callout absolute bolt-tooltip" role="tooltip" style="position:fixed;left:650px;top:178px"><div class="bolt-callout-content"><div class="bolt-tooltip-content body-m">Filter by person</div></div></div></div>',
      );
  });
}

/** The Mine tab's filter bar, open: the Active tab's bar and page CSS, as no capture has it open. */
async function openMineFilter(page: Page): Promise<void> {
  const active = fs.readFileSync(path.join(FIXTURES, "pr-list-win98-active.html"), "utf8");
  const start = active.indexOf(
    '<div class="page-content-left page-content-right page-content-top">',
  );
  const bar = active.slice(start, active.indexOf('<div class="page-content ', start));
  const css = fs.readFileSync(path.join(FIXTURES, "pr-list-win98-active.css"), "utf8");
  await page.evaluate(
    ([html, sheet]) => {
      document.head.prepend(Object.assign(document.createElement("style"), { textContent: sheet }));
      document.querySelector(".bolt-page > .bolt-tabbar")?.insertAdjacentHTML("afterend", html);
    },
    [bar, css],
  );
}

async function hoverFilterRow(page: Page): Promise<void> {
  await page.locator(".work-item-filter-dropdown li.bolt-list-row").nth(3).hover();
  await page.waitForTimeout(200);
}

/** The Overview's warnings box with an invented log line. */
function issueMessage(message: string): (page: Page) => Promise<void> {
  return async (page) => {
    await page.evaluate(setIssueMessage, message);
  };
}

/** The Files tree as it shows once the Viewed files feature has read it. The fake site never
 * ends that read, so the state drops the loading class itself. */
async function showLoadedTree(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const tree of document.querySelectorAll(".fix-ado-viewed-tree-loading")) {
      tree.classList.remove("fix-ado-viewed-tree-loading");
    }
  });
  await page.waitForTimeout(300);
}

const states: DiffState[] = [
  { artboard: "PullRequests", capture: "win98", name: "list", page: "pr-list", path: LIST },
  {
    artboard: "PullRequestsActive",
    capture: "win98-active",
    name: "list-active",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsGrouped",
    capture: "win98",
    init: 'GM_setValue("linked-work-item-grouped", true);',
    name: "list-grouped",
    page: "pr-list",
    path: LIST,
  },
  {
    act: openMineFilter,
    artboard: "PullRequestsMineFilter",
    capture: "win98",
    name: "list-mine-filter-open",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsInbox",
    capture: "win98",
    clip: { height: 750, width: 220, x: 0, y: 50 },
    name: "inbox-sidebar",
    page: "pr-inbox",
    path: "/fake-org/_pulls",
  },
  { artboard: "Main", capture: "win98", name: "overview", page: "pr-detail", path: `${PR}/1005` },
  {
    act: issueMessage(LONG_LINE),
    artboard: "MainIssueLongLine",
    capture: "win98",
    clip: { height: 400, width: 652, x: 248, y: 340 },
    name: "overview-issue-long-line",
    page: "pr-detail",
    path: `${PR}/1005`,
  },
  {
    act: issueMessage(MANY_LINES),
    artboard: "MainIssueManyLines",
    capture: "win98",
    clip: { height: 400, width: 652, x: 248, y: 340 },
    name: "overview-issue-many-lines",
    page: "pr-detail",
    path: `${PR}/1005`,
  },
  ...threadStates,
  {
    artboard: "MainChecksPassed",
    capture: "win98-checks-passed",
    name: "passed",
    page: "pr-detail",
    path: `${PR}/1003`,
  },
  {
    artboard: "MainDraft",
    capture: "win98-draft",
    clip: { height: 161, width: 652, x: 248, y: 158 },
    name: "draft",
    page: "pr-detail",
    path: `${PR}/1006`,
  },
  {
    artboard: "MainCompleted",
    capture: "win98-completed",
    clip: { height: 283, width: 652, x: 248, y: 158 },
    name: "completed",
    page: "pr-detail",
    path: `${PR}/1010`,
  },
  {
    artboard: "Commits",
    capture: "win98-commits-tab",
    name: "commits",
    page: "pr-detail",
    path: `${PR}/1005`,
  },
  {
    act: showLoadedTree,
    artboard: "FilesViewed",
    capture: "win98",
    name: "files-viewed",
    page: "pr-files",
    path: `${PR}/1005?_a=files`,
  },
  {
    artboard: "FilesTreeLoading",
    capture: "win98",
    // The bars pulse; the screenshot takes them at full strength, as the artboard draws them.
    mask: ".fix-ado-viewed-tree-loading { animation: none !important; }",
    name: "files-tree-loading",
    page: "pr-files",
    path: `${PR}/1005?_a=files`,
  },
  {
    artboard: "Board",
    capture: "win98-settings",
    mask: SVG_MASK,
    name: "board",
    page: "board",
    path: BOARD,
  },
  {
    artboard: "BoardFilter",
    capture: "win98-board-filter",
    clip: { height: 206, width: 272, x: 420, y: 165 },
    mask: SVG_MASK,
    name: "board-filter-open",
    page: "board",
    path: BOARD,
  },
  {
    act: hoverFilterRow,
    artboard: "BoardFilterHover",
    capture: "win98-board-filter-with-hover",
    clip: { height: 206, width: 272, x: 420, y: 165 },
    mask: SVG_MASK,
    name: "board-filter-hover",
    page: "board",
    path: BOARD,
  },
  {
    act: showTooltip,
    artboard: "Tooltip",
    capture: "win98-settings",
    clip: { height: 40, width: 140, x: 630, y: 168 },
    mask: SVG_MASK,
    name: "tooltip",
    page: "board",
    path: BOARD,
  },
  {
    artboard: "PipelineRunSummary",
    capture: "win98",
    clip: { height: 750, width: 1060, x: 220, y: 50 },
    mask: SVG_MASK,
    name: "run-summary",
    page: "pipeline-summary",
    path: RUN,
  },
  {
    artboard: "PipelineRunSteps",
    capture: "win98",
    mask: SVG_MASK,
    name: "run-steps",
    page: "pipeline-steps",
    path: `${RUN}&view=logs`,
  },
];

const config: RestyleConfig = {
  auditPages: [
    { capture: "win98", name: "list", page: "pr-list", path: LIST },
    { capture: "win98-active", name: "list-active", page: "pr-list", path: LIST },
    { capture: "win98", name: "inbox", page: "pr-inbox", path: "/fake-org/_pulls" },
    {
      capture: "win98-reviewer-search",
      name: "create",
      page: "pr-create",
      path: "/fake-org/fake-project/_git/fake-repository/pullrequestcreate",
    },
    { capture: "win98", name: "overview", page: "pr-detail", path: `${PR}/1005` },
    { capture: "win98-draft", name: "draft", page: "pr-detail", path: `${PR}/1006` },
    { capture: "win98-completed", name: "completed", page: "pr-detail", path: `${PR}/1010` },
    { capture: "win98", name: "files", page: "pr-files", path: `${PR}/1005?_a=files` },
    { capture: "win98-settings", name: "board", page: "board", path: BOARD },
    {
      capture: "win98",
      name: "work-item",
      page: "work-item",
      path: "/fake-org/fake-project/_workitems/edit/1001/",
    },
    { capture: "win98", name: "run-summary", page: "pipeline-summary", path: RUN },
    { capture: "win98", name: "run-steps", page: "pipeline-steps", path: `${RUN}&view=logs` },
  ],
  checks: [boardWidth, dropDownVariants, issueBoxOverflow, threadHeaders, treeScroll],
  masks: { design: "[data-glyph] { visibility: hidden !important; }", site: SITE_MASK },
  settings: { "windows-98-mode": true },
  states,
};

export default config;
