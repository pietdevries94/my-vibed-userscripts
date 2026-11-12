// What the Pipeline tab shows for one pull request: its checks, the timelines of
// the runs it opened, and what the owner picked. Loads and refreshes them.
import type { PipelineTabPick, ShownRun } from "./pipeline-tab-selection.ts";
import type { RunStage, TimelineRecord } from "./pipeline-timeline.ts";
import type { ChecksState } from "./pipeline-tab-panel.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import { pipelineChecksOf } from "./pipeline-checks.ts";
import { shownRunOf } from "./pipeline-tab-selection.ts";
import { stagesOf } from "./pipeline-timeline.ts";

/** The checks are fetched again after this long. */
const CHECKS_REFRESH_MS = 30_000;
/** The timeline of a run in progress is fetched again after this long. */
const RUNNING_TIMELINE_REFRESH_MS = 10_000;

interface PipelineTabSources {
  getEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluation[]>;
  getTimeline: (project: string, buildId: number) => Promise<TimelineRecord[]>;
  now: () => number;
}

interface PipelineTabData {
  pullRequest: PullRequestRef;
  checks: ChecksState;
  checksLoadedAt: number;
  /** The stages of each run whose timeline came in, by build id. */
  stagesByBuildId: Map<number, RunStage[]>;
  timelineLoadedAt: Map<number, number>;
  pick: PipelineTabPick;
}

/** Loads into one pull request's data, and says when something came in. */
interface PipelineTabLoader {
  data: PipelineTabData;
  sources: PipelineTabSources;
  onChange: () => void;
}

const NO_PICK: PipelineTabPick = { buildId: null, folded: null, stageId: null, stepId: null };

function createTabData(pullRequest: PullRequestRef): PipelineTabData {
  return {
    checks: { kind: "loading" },
    checksLoadedAt: Number.NEGATIVE_INFINITY,
    pick: NO_PICK,
    pullRequest,
    stagesByBuildId: new Map(),
    timelineLoadedAt: new Map(),
  };
}

function shownRunOfData(data: PipelineTabData): ShownRun | null {
  return data.checks.kind === "loaded"
    ? shownRunOf(data.checks.checks, data.stagesByBuildId, data.pick)
    : null;
}

async function loadChecks({ data, onChange, sources }: PipelineTabLoader): Promise<void> {
  data.checksLoadedAt = sources.now();
  try {
    const evaluations = await sources.getEvaluations(data.pullRequest);
    data.checks = { checks: pipelineChecksOf(evaluations), kind: "loaded" };
  } catch {
    // Keep the checks already shown; a later refresh tries again.
    data.checks = data.checks.kind === "loaded" ? data.checks : { kind: "failed" };
  }
  onChange();
}

async function loadTimeline(loader: PipelineTabLoader, buildId: number): Promise<void> {
  const { data, onChange, sources } = loader;
  data.timelineLoadedAt.set(buildId, sources.now());
  try {
    const records = await sources.getTimeline(data.pullRequest.project, buildId);
    data.stagesByBuildId.set(buildId, stagesOf(records));
  } catch {
    // The run shows "Loading steps…" until a later refresh gets through.
  }
  onChange();
}

function isTimelineDue(data: PipelineTabData, shown: ShownRun, now: number): boolean {
  const loadedAt = data.timelineLoadedAt.get(shown.check.buildId);
  if (loadedAt === undefined) {
    return true;
  }
  const isRunning = shown.check.status === "running" || shown.check.status === "queued";
  return (isRunning || shown.stages === null) && now - loadedAt >= RUNNING_TIMELINE_REFRESH_MS;
}

/** Starts the loads that are due: the checks now and then, and the shown run's timeline. */
function loadWhatIsDue(loader: PipelineTabLoader): void {
  const { data, sources } = loader;
  const now = sources.now();
  if (now - data.checksLoadedAt >= CHECKS_REFRESH_MS) {
    void loadChecks(loader);
  }
  const shown = shownRunOfData(data);
  if (shown !== null && isTimelineDue(data, shown, now)) {
    void loadTimeline(loader, shown.check.buildId);
  }
}

export type { PipelineTabData, PipelineTabLoader, PipelineTabSources };
export { createTabData, loadWhatIsDue, shownRunOfData };
