// The warnings and errors of each build check's latest run, above the description on a
// pull request's Overview. A click on one opens the Pipeline tab on its step.
import type { RunStage, TimelineRecord } from "./pipeline-timeline.ts";
import {
  createElement,
  createIssueBox,
  createKindIcon,
  fillIssueLink,
  issueSummary,
  worstKindOf,
  wrapIn,
} from "./pipeline-issue-list.ts";
import type { ElementSpec } from "./pipeline-issue-list.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { RunIssue } from "./pipeline-issues.ts";
import { pipelineChecksOf } from "./pipeline-checks.ts";
import { pipelineLogPath } from "./pipeline-run-link.ts";
import { runIssuesOf } from "./pipeline-issues.ts";
import { stagesOf } from "./pipeline-timeline.ts";

/** The checks are fetched again after this long, and so is a busy run's timeline. */
const REFRESH_MS = 30_000;
const DESCRIPTION_SELECTOR = ".repos-pr-description-card";
const BLOCK_CLASS = "fix-ado-overview-issues";

interface OverviewPipelineIssuesOptions {
  apiBasePath: string;
  document: Document;
  getEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluation[]>;
  getTimeline: (project: string, buildId: number) => Promise<TimelineRecord[]>;
  now: () => number;
}

interface OverviewPipelineIssues {
  /** Shows the block on the pull request's Overview, and fetches what is due when `canFetch`. */
  sync: (pullRequest: PullRequestRef | null, canFetch: boolean) => void;
}

/** A run's timeline as it came in, and the check status it was fetched for. */
interface LoadedTimeline {
  stages: RunStage[] | null;
  loadedAt: number;
  checkStatus: string | null;
}

/** What the block knows of one pull request. */
interface OverviewData {
  pullRequest: PullRequestRef;
  checks: PipelineCheck[];
  checksLoadedAt: number;
  timelines: Map<number, LoadedTimeline>;
}

interface OverviewState {
  options: OverviewPipelineIssuesOptions;
  /** The pull request on the page, or null on other pages. */
  data: OverviewData | null;
}

/** A check whose latest run has issues, as the block shows it. */
interface CheckIssues {
  check: PipelineCheck;
  stages: RunStage[];
  issues: RunIssue[];
}

function isBusy(check: PipelineCheck): boolean {
  return check.status === "running" || check.status === "queued";
}

/** A check's run is due when it is new, changed status, or is busy and was fetched a while ago. */
function isTimelineDue(data: OverviewData, check: PipelineCheck, now: number): boolean {
  const loaded = data.timelines.get(check.buildId);
  return (
    loaded === undefined ||
    loaded.checkStatus !== check.status ||
    (isBusy(check) && now - loaded.loadedAt >= REFRESH_MS)
  );
}

function checksWithIssues(data: OverviewData): CheckIssues[] {
  return data.checks.flatMap((check) => {
    const stages = data.timelines.get(check.buildId)?.stages ?? [];
    const issues = runIssuesOf(stages);
    return issues.length > 0 ? [{ check, issues, stages }] : [];
  });
}

/** The log of the issue's step, or its run when it has no step. */
function runLinkOf(
  { apiBasePath }: OverviewPipelineIssuesOptions,
  { buildId, project }: { buildId: number; project: string },
  { jobId, stepId }: RunIssue,
): string {
  return jobId !== null && stepId !== null
    ? pipelineLogPath(apiBasePath, project, { buildId, jobId, stepId })
    : `${apiBasePath}/${encodeURIComponent(project)}/_build/results?buildId=${buildId}`;
}

function createCheckIssueBox(
  options: OverviewPipelineIssuesOptions,
  project: string,
  { check, issues, stages }: CheckIssues,
): HTMLElement {
  const { document } = options;
  const run = { buildId: check.buildId, project };
  return createIssueBox(document, {
    createLink: (issue) => {
      const link = document.createElement("a");
      link.href = runLinkOf(options, run, issue);
      return fillIssueLink(link, issue);
    },
    details: issueSummary(stages),
    issues,
    title: check.name,
  });
}

function headingOf(checks: CheckIssues[]): string {
  const runs = checks.length === 1 ? "the latest run" : "the latest runs";
  return `${issueSummary(checks.flatMap(({ stages }) => stages))} in ${runs}`;
}

/** Azure DevOps's status card around its rows, innermost first. */
const CARD_WRAPPERS: ElementSpec[] = [
  { className: "flex-column flex-grow scroll-hidden", tag: "div" },
  { className: "bolt-card-content flex-row flex-grow bolt-default-horizontal-spacing", tag: "div" },
  {
    className: `bolt-table-card bolt-card flex-column depth-8 bolt-card-white ${BLOCK_CLASS}`,
    role: "region",
    tag: "section",
  },
];

/** The heading row, as on Azure DevOps's status card: a large status icon and a line of text. */
function createHeading(document: Document, checks: CheckIssues[]): HTMLElement {
  const heading = createElement(document, {
    className: "fix-ado-overview-issues-heading",
    tag: "span",
    text: headingOf(checks),
  });
  const text = wrapIn(document, heading, [
    { className: "flex-column flex-grow scroll-hidden", tag: "div" },
  ]);
  const row = createElement(document, {
    className: "flex-row flex-center rhythm-horizontal-8",
    tag: "div",
  });
  const kind = worstKindOf(checks.flatMap(({ issues }) => issues));
  row.append(createKindIcon(document, kind, "large"), text);
  return row;
}

/** A card like Azure DevOps's status card, with a box per check, as its check list has. */
function createBlock(state: OverviewState, data: OverviewData, checks: CheckIssues[]): HTMLElement {
  const { document } = state.options;
  const rows = createElement(document, {
    className: "padding-vertical-16 padding-horizontal-20 rhythm-vertical-16",
    tag: "div",
  });
  const { project } = data.pullRequest;
  rows.append(
    createHeading(document, checks),
    ...checks.map((checkIssues) => createCheckIssueBox(state.options, project, checkIssues)),
  );
  const block = wrapIn(document, rows, CARD_WRAPPERS);
  block.setAttribute("aria-label", "Pipeline warnings and errors");
  block.dataset.fixAdoRendered = JSON.stringify(checks);
  return block;
}

/** True when the block on the page already shows these checks, above the description. */
function isBlockShown(
  block: HTMLElement | null,
  checks: CheckIssues[],
  description: Element,
): boolean {
  return (
    block?.dataset.fixAdoRendered === JSON.stringify(checks) &&
    block.nextElementSibling === description
  );
}

/** Puts the block above the description, or takes it away when there is nothing to show. */
function render(state: OverviewState): void {
  const { data, options } = state;
  const description = options.document.querySelector(DESCRIPTION_SELECTOR);
  const existing = options.document.querySelector<HTMLElement>(`.${BLOCK_CLASS}`);
  const checks = data === null ? [] : checksWithIssues(data);
  if (description === null || data === null || checks.length === 0) {
    existing?.remove();
    return;
  }
  if (!isBlockShown(existing, checks, description)) {
    existing?.remove();
    description.before(createBlock(state, data, checks));
  }
}

/** Shows what came in, unless the page left that pull request meanwhile. */
function showIfCurrent(state: OverviewState, data: OverviewData): void {
  if (state.data === data) {
    render(state);
  }
}

async function loadTimeline(
  state: OverviewState,
  data: OverviewData,
  check: PipelineCheck,
): Promise<void> {
  const { options } = state;
  const loaded: LoadedTimeline = {
    checkStatus: check.status,
    loadedAt: options.now(),
    stages: data.timelines.get(check.buildId)?.stages ?? null,
  };
  data.timelines.set(check.buildId, loaded);
  try {
    loaded.stages = stagesOf(await options.getTimeline(data.pullRequest.project, check.buildId));
  } catch {
    // The block keeps what it showed; the next refresh tries again.
  }
  showIfCurrent(state, data);
}

/** The checks, then the runs of theirs that are due. */
async function loadChecks(state: OverviewState, data: OverviewData): Promise<void> {
  const { options } = state;
  data.checksLoadedAt = options.now();
  try {
    data.checks = pipelineChecksOf(await options.getEvaluations(data.pullRequest));
  } catch {
    return;
  }
  const now = options.now();
  for (const check of data.checks.filter((candidate) => isTimelineDue(data, candidate, now))) {
    void loadTimeline(state, data, check);
  }
  showIfCurrent(state, data);
}

function syncOverview(
  state: OverviewState,
  pullRequest: PullRequestRef | null,
  canFetch: boolean,
): void {
  if (JSON.stringify(state.data?.pullRequest ?? null) !== JSON.stringify(pullRequest)) {
    state.data =
      pullRequest === null
        ? null
        : {
            checks: [],
            checksLoadedAt: Number.NEGATIVE_INFINITY,
            pullRequest,
            timelines: new Map(),
          };
  }
  render(state);
  const { data, options } = state;
  const isOnOverview = options.document.querySelector(DESCRIPTION_SELECTOR) !== null;
  if (
    data !== null &&
    canFetch &&
    isOnOverview &&
    options.now() - data.checksLoadedAt >= REFRESH_MS
  ) {
    void loadChecks(state, data);
  }
}

function createOverviewPipelineIssues(
  options: OverviewPipelineIssuesOptions,
): OverviewPipelineIssues {
  const state: OverviewState = { data: null, options };
  return {
    sync: (pullRequest, canFetch) => {
      syncOverview(state, pullRequest, canFetch);
    },
  };
}

export type { OverviewPipelineIssues };
export { createOverviewPipelineIssues };
