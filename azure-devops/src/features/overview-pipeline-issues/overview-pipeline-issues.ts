// The warnings and errors of each build check's latest run, above the description on a
// pull request's Overview. A click on one opens the Pipeline tab on its step. An error
// that Azure DevOps's own checks area already shows for that run is left out.
import { OVERVIEW_ISSUES_CLASS, createIssuesCard } from "./overview-pipeline-issues-card.ts";
import type { RunStage, TimelineRecord } from "../../pipeline/pipeline-timeline.ts";
import { runIssuesOf, sumIssueCounts } from "../../pipeline/pipeline-issues.ts";
import type { CheckIssues } from "./overview-pipeline-issues-card.ts";
import type { PipelineCheck } from "../../pipeline/pipeline-checks.ts";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import { parsePipelineRunLocation } from "../../pipeline/pipeline-run-link.ts";
import { pipelineChecksOf } from "../../pipeline/pipeline-checks.ts";
import { stagesOf } from "../../pipeline/pipeline-timeline.ts";

/** The checks are fetched again after this long, and so is a busy run's timeline. */
const REFRESH_MS = 30_000;
const DESCRIPTION_SELECTOR = ".repos-pr-description-card";
/** An error line in Azure DevOps's checks area, under a failed check. */
const CHECKS_AREA_ERROR_SELECTOR = ".dark-build-output .error-text";
const RUN_LINK_SELECTOR = 'a[href*="/_build/results?"]';

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

/**
 * The error messages Azure DevOps's own checks area shows, by the build id of the run
 * whose link they sit in. The script's own card does not count.
 */
function checksAreaErrorsOf(document: Document): Map<number, Set<string>> {
  const errors = new Map<number, Set<string>>();
  for (const line of document.querySelectorAll(CHECKS_AREA_ERROR_SELECTOR)) {
    const href = line.closest(RUN_LINK_SELECTOR)?.getAttribute("href");
    const run =
      href === undefined || href === null || line.closest(`.${OVERVIEW_ISSUES_CLASS}`) !== null
        ? null
        : parsePipelineRunLocation(new URL(href, document.baseURI));
    if (run !== null) {
      errors.set(run.buildId, (errors.get(run.buildId) ?? new Set()).add(line.textContent.trim()));
    }
  }
  return errors;
}

/** A check's issues and counts, without the errors the checks area already shows. */
function checkIssuesOf(
  check: PipelineCheck,
  stages: RunStage[],
  shownErrors: Set<string>,
): CheckIssues {
  const all = runIssuesOf(stages);
  const issues = all.filter(
    (issue) => issue.kind !== "error" || !shownErrors.has(issue.message.trim()),
  );
  const { errorCount, warningCount } = sumIssueCounts(stages);
  const hiddenCount = all.length - issues.length;
  return {
    check,
    counts: { errorCount: Math.max(0, errorCount - hiddenCount), warningCount },
    issues,
  };
}

function checksWithIssues(data: OverviewData, document: Document): CheckIssues[] {
  const checksAreaErrors = checksAreaErrorsOf(document);
  return data.checks.flatMap((check) => {
    const stages = data.timelines.get(check.buildId)?.stages ?? [];
    const shownErrors = checksAreaErrors.get(check.buildId) ?? new Set<string>();
    const checkIssues = checkIssuesOf(check, stages, shownErrors);
    return checkIssues.issues.length > 0 ? [checkIssues] : [];
  });
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
  const existing = options.document.querySelector<HTMLElement>(`.${OVERVIEW_ISSUES_CLASS}`);
  const checks = data === null ? [] : checksWithIssues(data, options.document);
  if (description === null || data === null || checks.length === 0) {
    existing?.remove();
    return;
  }
  if (!isBlockShown(existing, checks, description)) {
    existing?.remove();
    description.before(createCard(options, data, checks));
  }
}

function createCard(
  { apiBasePath, document }: OverviewPipelineIssuesOptions,
  data: OverviewData,
  checks: CheckIssues[],
): HTMLElement {
  return createIssuesCard(document, { apiBasePath, checks, project: data.pullRequest.project });
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
