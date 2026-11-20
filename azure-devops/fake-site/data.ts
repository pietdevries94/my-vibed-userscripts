// The captured pages behind the fake site, with invented names for the capture's
// name tokens. Read from the fixtures on every request, so a new capture shows at once.
import { AVATAR_SELECTOR, avatarName } from "../src/pull-requests/avatars.ts";
import { standInLabels, withStandInLabels } from "../../shared/dev/fake-site/stand-in-labels.ts";
import type { BoardWorkItem } from "../src/boards/board.ts";
import { JSDOM } from "jsdom";
import type { ListedPullRequest } from "../src/features/reload-on-changes/pr-list-changes.ts";
import type { PolicyEvaluation } from "../src/pipeline/pipeline-status.ts";
import { fixtureReader } from "../../shared/dev/fake-site/server.ts";
import fs from "node:fs";
import path from "node:path";
import { withOverviewVariants } from "./overview-variants.ts";

type Page =
  | "board"
  | "pr-list"
  | "pr-inbox"
  | "pr-detail"
  | "pr-files"
  | "pr-create"
  | "pipeline-summary"
  | "pipeline-steps"
  | "pipeline-log"
  | "pipeline-run-tab"
  | "work-item";

/** A policy evaluations response as the capture recorded it. */
interface CapturedEvaluations {
  body: { value: PolicyEvaluation[] } | null;
  httpStatus: number;
}

interface PullRequestPageData {
  data: {
    evaluationsByPullRequestId: Record<string, CapturedEvaluations>;
    pullRequests?: ListedPullRequest[];
  };
  meta: { projects: Record<string, string>; statusColors: Record<string, string> };
}

/** A run timeline as the capture recorded it. */
interface CapturedTimeline {
  /** The timeline records, passed on as captured. */
  body: { records: unknown[] } | null;
  httpStatus: number;
}

interface PullRequestDetailData {
  data: {
    evaluations: CapturedEvaluations;
    /** The run list, passed on as captured. */
    builds?: { body: { value: unknown[] } | null; httpStatus: number };
    timelinesByBuildId?: Record<string, CapturedTimeline>;
  };
}

/** What a pull request capture took along for a review, passed on as captured. */
interface ReviewData {
  data: {
    review: {
      iterations: { body: unknown };
      newestIterationChanges: { body: unknown } | null;
      threads: { body: { value: unknown[] } | null };
    };
  };
}

interface BoardData {
  data: { myUserId: string | null; workItems: BoardWorkItem[] };
}

const SCRIPT_DIRECTORY = path.join(import.meta.dirname, "..");
const TOKEN = /^text-\d+$/u;
const readFixture = fixtureReader(SCRIPT_DIRECTORY);
/** The capture behind each page, where it is not named after the page. */
const PAGE_FIXTURES: Partial<Record<Page, string>> = {
  // A run page on its Code Coverage tab.
  "pipeline-run-tab": "pipeline-run-tab-coverage",
  // The create page once a branch is picked: the first capture with the reviewer field.
  "pr-create": "pr-create-with-branch-selected",
  "pr-detail": "pr-detail-warnings",
  // The Files tab with a comment box open on a line.
  "pr-files": "pr-files-composer",
  // A user story, with the assignee's avatar in the header.
  "work-item": "work-item-work-item-header",
};
/** The captures the pages show until an action picks another. */
const DEFAULT_PAGE_FIXTURES = { ...PAGE_FIXTURES };
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
const DEFAULT_PULL_REQUEST_CAPTURE = "warnings";
const DEFAULT_FILES_CAPTURE = "composer";

function fixtureOfPage(page: Page): string {
  return PAGE_FIXTURES[page] ?? page;
}

/** Shows another capture as the pull request page, such as "reviewers" for pr-detail-reviewers. */
function showPullRequestCapture(name: string): string {
  const fixture = `pr-detail-${name === "" ? DEFAULT_PULL_REQUEST_CAPTURE : name}`;
  readFixture(`${fixture}.html`);
  PAGE_FIXTURES["pr-detail"] = fixture;
  return fixture;
}

/** Shows another capture as the Files tab, such as "side-by-side-pending". "plain" is pr-files itself. */
function showFilesCapture(name: string): string {
  const suffix = name === "" ? DEFAULT_FILES_CAPTURE : name;
  const fixture = suffix === "plain" ? "pr-files" : `pr-files-${suffix}`;
  readFixture(`${fixture}.html`);
  PAGE_FIXTURES["pr-files"] = fixture;
  return fixture;
}

function isPage(name: string | null): name is Page {
  return PAGES.some((page) => page === name);
}

/**
 * Shows a named capture as any page, such as "win98" on pr-list for pr-list-win98. Without a
 * name the page shows its default capture again.
 */
function showCapture(page: string | null, name: string): string {
  if (!isPage(page)) {
    return `Unknown page. Pick one of: ${PAGES.join(", ")}.`;
  }
  const fixture = name === "" ? (DEFAULT_PAGE_FIXTURES[page] ?? page) : `${page}-${name}`;
  readFixture(`${fixture}.html`);
  PAGE_FIXTURES[page] = fixture;
  return fixture;
}

/** Every page shows its default capture again. */
function showDefaultCaptures(): void {
  for (const page of PAGES) {
    showCapture(page, "");
  }
}

/** The site's CSS the capture saved for a page, or null when it saved none. */
function pageCss(page: Page): string | null {
  const file = path.join(SCRIPT_DIRECTORY, "fixtures", `${fixtureOfPage(page)}.css`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}
const labelCache = new Map<string, { changedAt: number; labels: Map<string, string> }>();

/** Tokens that stand for names: display names in the JSON, then avatar labels on the page. */
function nameTokens(page: Page): string[] {
  const fromJson = [
    ...readFixture(`${fixtureOfPage(page)}.json`).matchAll(/"displayName": "(?<token>[^"]*)"/gu),
  ]
    .map((match) => match.groups?.token ?? "")
    .filter((token) => TOKEN.test(token));
  const { document } = new JSDOM(readFixture(`${fixtureOfPage(page)}.html`)).window;
  const fromAvatars = [...document.querySelectorAll(AVATAR_SELECTOR)]
    .map((avatar) => avatarName(avatar).trim())
    .filter((token) => TOKEN.test(token));
  return [...fromJson, ...fromAvatars];
}

/** The invented name per name token of a page. Worked out again when the fixture changes. */
function labelsOf(page: Page): Map<string, string> {
  const changedAt = fs.statSync(
    path.join(SCRIPT_DIRECTORY, "fixtures", `${fixtureOfPage(page)}.html`),
  ).mtimeMs;
  const cached = labelCache.get(fixtureOfPage(page));
  if (cached?.changedAt === changedAt) {
    return cached.labels;
  }
  const labels = standInLabels(nameTokens(page));
  labelCache.set(fixtureOfPage(page), { changedAt, labels });
  return labels;
}

function pageHtml(page: Page): string {
  const html = withStandInLabels(readFixture(`${fixtureOfPage(page)}.html`), labelsOf(page));
  return page === "pr-detail" ? withOverviewVariants(html) : html;
}

function pageJson(page: Page): unknown {
  const json = readFixture(`${fixtureOfPage(page)}.json`);
  return JSON.parse(withStandInLabels(json, labelsOf(page)));
}

function pullRequestPageData(page: "pr-list" | "pr-inbox"): PullRequestPageData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  return pageJson(page) as PullRequestPageData;
}

function pullRequestDetailData(): PullRequestDetailData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  return pageJson("pr-detail") as PullRequestDetailData;
}

function reviewData(): ReviewData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  return pageJson("pr-files") as ReviewData;
}

/** The pull request page's path, from the link of its first tab. Null when there is none. */
function pullRequestDetailPath(): string | null {
  const match = /href="(?<path>\/fake-org\/[^/"]+\/_git\/[^/"]+\/pullrequest\/\d+)"/u.exec(
    readFixture(`${fixtureOfPage("pr-detail")}.html`),
  );
  return match?.groups?.path ?? null;
}

function boardData(): BoardData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  return pageJson("board") as BoardData;
}

/** The repository list's path, from the link of its first row. Null when there is no row. */
function pullRequestListPath(): string | null {
  const match = /href="(?<repository>\/fake-org\/[^/"]+\/_git\/[^/"]+)\/pullrequest\//u.exec(
    readFixture("pr-list.html"),
  );
  return match?.groups?.repository === undefined ? null : `${match.groups.repository}/pullrequests`;
}

export type { CapturedEvaluations, Page, PullRequestPageData };
export {
  boardData,
  pageCss,
  pageHtml,
  pullRequestDetailData,
  pullRequestDetailPath,
  pullRequestListPath,
  pullRequestPageData,
  reviewData,
  showCapture,
  showDefaultCaptures,
  showFilesCapture,
  showPullRequestCapture,
};
