// The captured pages behind the fake site, with invented names for the capture's
// name tokens. Read from the fixtures on every request, so a new capture shows at once.
import { AVATAR_SELECTOR, avatarName } from "../src/avatars.ts";
import { standInLabels, withStandInLabels } from "../../shared/dev/fake-site/stand-in-labels.ts";
import type { BoardWorkItem } from "../src/board.ts";
import { JSDOM } from "jsdom";
import type { ListedPullRequest } from "../src/pr-list-changes.ts";
import type { PolicyEvaluation } from "../src/pipeline-status.ts";
import { fixtureReader } from "../../shared/dev/fake-site/server.ts";
import fs from "node:fs";
import path from "node:path";

type Page =
  | "board"
  | "pr-list"
  | "pr-inbox"
  | "pr-detail"
  | "pipeline-summary"
  | "pipeline-steps"
  | "pipeline-log";

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

interface BoardData {
  data: { myUserId: string | null; workItems: BoardWorkItem[] };
}

const SCRIPT_DIRECTORY = path.join(import.meta.dirname, "..");
const TOKEN = /^text-\d+$/u;
const readFixture = fixtureReader(SCRIPT_DIRECTORY);
/** The capture behind each page, where it is not named after the page. */
const PAGE_FIXTURES: Partial<Record<Page, string>> = { "pr-detail": "pr-detail-warnings" };

function fixtureOfPage(page: Page): string {
  return PAGE_FIXTURES[page] ?? page;
}
const labelCache = new Map<Page, { changedAt: number; labels: Map<string, string> }>();

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
  const cached = labelCache.get(page);
  if (cached?.changedAt === changedAt) {
    return cached.labels;
  }
  const labels = standInLabels(nameTokens(page));
  labelCache.set(page, { changedAt, labels });
  return labels;
}

function pageHtml(page: Page): string {
  return withStandInLabels(readFixture(`${fixtureOfPage(page)}.html`), labelsOf(page));
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
  pageHtml,
  pullRequestDetailData,
  pullRequestDetailPath,
  pullRequestListPath,
  pullRequestPageData,
};
