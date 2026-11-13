// What the Pipeline tab shows for one pull request: its runs, the timelines of
// the runs it opened, and what the owner picked. Loads and refreshes them.
import type { PipelineTabPick, ShownRun } from "./pipeline-tab-selection.ts";
import type { RunAction, RunActionState } from "./pipeline-tab-run-action.ts";
import type { RunStage, TimelineRecord } from "../../pipeline/pipeline-timeline.ts";
import { pipelineChecksOf, startableChecksOf } from "../../pipeline/pipeline-checks.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { RunsState } from "./pipeline-tab-panel.ts";
import { log } from "../../../../shared/runtime/script-log.ts";
import { pipelineRunsOf } from "../../pipeline/pipeline-runs.ts";
import { shownRunOf } from "./pipeline-tab-selection.ts";
import { stagesOf } from "../../pipeline/pipeline-timeline.ts";

/** The runs are fetched again after this long. */
const RUNS_REFRESH_MS = 30_000;
/** After a start or cancel, the runs are fetched this often for a while, to show the new run soon. */
const ACTED_RUNS_REFRESH_MS = 5000;
const ACTED_RUNS_REFRESH_WINDOW_MS = 60_000;
/** The timeline of a run in progress is fetched again after this long, to follow its steps. */
const RUNNING_TIMELINE_REFRESH_MS = 5000;

interface PipelineTabSources {
  getEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluation[]>;
  getPullRequestBuilds: (pullRequest: PullRequestRef) => Promise<PullRequestBuild[]>;
  getTimeline: (project: string, buildId: number) => Promise<TimelineRecord[]>;
  now: () => number;
  /** Cancels a queued or running run. */
  cancelRun: (project: string, buildId: number) => Promise<void>;
  /** Starts a new run of a build check. */
  requeueCheck: (pullRequest: PullRequestRef, evaluationId: string) => Promise<void>;
}

interface PipelineTabData {
  pullRequest: PullRequestRef;
  runs: RunsState;
  runsLoadedAt: number;
  /** Until when the runs refresh fast, after a start or cancel. */
  fastRunsRefreshUntil: number;
  /** The stages of each run whose timeline came in, by build id. */
  stagesByBuildId: Map<number, RunStage[]>;
  timelineLoadedAt: Map<number, number>;
  pick: PipelineTabPick;
  runActionState: RunActionState;
}

/** Loads into one pull request's data, and says when something came in. */
interface PipelineTabLoader {
  data: PipelineTabData;
  sources: PipelineTabSources;
  onChange: () => void;
}

const NO_PICK: PipelineTabPick = {
  buildId: null,
  folded: null,
  jobId: null,
  stageId: null,
  stepId: null,
};

function createTabData(pullRequest: PullRequestRef): PipelineTabData {
  return {
    fastRunsRefreshUntil: Number.NEGATIVE_INFINITY,
    pick: NO_PICK,
    pullRequest,
    runActionState: "idle",
    runs: { kind: "loading" },
    runsLoadedAt: Number.NEGATIVE_INFINITY,
    stagesByBuildId: new Map(),
    timelineLoadedAt: new Map(),
  };
}

function shownRunOfData(data: PipelineTabData): ShownRun | null {
  return data.runs.kind === "loaded"
    ? shownRunOf(data.runs.runs, data.stagesByBuildId, data.pick)
    : null;
}

/** Notes in the script log why the run list did not load. */
function logRunListFailure(error: unknown): PullRequestBuild[] {
  if (error instanceof AdoRequestError) {
    log("Pipeline tab: Azure DevOps refused the run list", { httpStatus: error.httpStatus });
  } else {
    log("Pipeline tab: the run list request failed without an answer");
  }
  return [];
}

/** The pull request's runs. Without the run list, the checks' runs still show. */
async function loadRuns({ data, onChange, sources }: PipelineTabLoader): Promise<void> {
  data.runsLoadedAt = sources.now();
  try {
    const [evaluations, builds] = await Promise.all([
      sources.getEvaluations(data.pullRequest),
      sources.getPullRequestBuilds(data.pullRequest).catch(logRunListFailure),
    ]);
    const checks = pipelineChecksOf(evaluations);
    log("Pipeline tab: runs loaded", { checkCount: checks.length, runCount: builds.length });
    data.runs = {
      kind: "loaded",
      runs: pipelineRunsOf(checks, builds),
      startableChecks: startableChecksOf(evaluations),
    };
  } catch {
    // Keep the runs already shown; a later refresh tries again.
    data.runs = data.runs.kind === "loaded" ? data.runs : { kind: "failed" };
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
  const loadedAt = data.timelineLoadedAt.get(shown.run.buildId);
  if (loadedAt === undefined) {
    return true;
  }
  const status = shown.run.status?.status;
  const isRunning =
    status === "running" ||
    status === "queued" ||
    (shown.stages ?? []).some((stage) => stage.state !== "completed");
  return (isRunning || shown.stages === null) && now - loadedAt >= RUNNING_TIMELINE_REFRESH_MS;
}

/** Starts the loads that are due: the runs now and then, and the shown run's timeline. */
function loadWhatIsDue(loader: PipelineTabLoader): void {
  const { data, sources } = loader;
  const now = sources.now();
  const runsRefreshMs = now < data.fastRunsRefreshUntil ? ACTED_RUNS_REFRESH_MS : RUNS_REFRESH_MS;
  if (now - data.runsLoadedAt >= runsRefreshMs) {
    void loadRuns(loader);
  }
  const shown = shownRunOfData(data);
  if (shown !== null && isTimelineDue(data, shown, now)) {
    void loadTimeline(loader, shown.run.buildId);
  }
}

/** Sends the start or cancel. On success the runs are due again, to show the change soon. */
async function sendRunAction(
  loader: PipelineTabLoader,
  action: RunAction,
  key: string,
): Promise<RunActionState> {
  const { data, sources } = loader;
  try {
    await (action === "start"
      ? sources.requeueCheck(data.pullRequest, key)
      : sources.cancelRun(data.pullRequest.project, Number(key)));
    data.runsLoadedAt = Number.NEGATIVE_INFINITY;
    data.fastRunsRefreshUntil = sources.now() + ACTED_RUNS_REFRESH_WINDOW_MS;
    log(
      `Pipeline tab: run action ${action} sent`,
      action === "cancel" ? { buildId: Number(key) } : {},
    );
    return "idle";
  } catch (error) {
    log(`Pipeline tab: Azure DevOps refused run action ${action}`, {
      httpStatus: error instanceof AdoRequestError ? error.httpStatus : null,
    });
    return "failed";
  }
}

/** Starts a new run of a build check, or cancels a run, and shows the button wait meanwhile. */
async function performRunAction(
  loader: PipelineTabLoader,
  action: RunAction,
  key: string,
): Promise<void> {
  loader.data.runActionState = "waiting";
  loader.onChange();
  loader.data.runActionState = await sendRunAction(loader, action, key);
  loader.onChange();
}

/** Makes the run's timeline due now, so the next load fetches it. */
function expireTimeline(data: PipelineTabData, buildId: number): void {
  data.timelineLoadedAt.delete(buildId);
}

export type { PipelineTabData, PipelineTabLoader, PipelineTabSources };
export { createTabData, expireTimeline, loadWhatIsDue, performRunAction, shownRunOfData };
