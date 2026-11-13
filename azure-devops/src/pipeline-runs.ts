// The runs the Pipeline tab lists: every run of the pull request, newest first, as the
// builds API orders them. A run that is a current build check keeps the check's name
// and Required/Optional label.
import type { PipelineCheck, PullRequestBuild } from "./pipeline-checks.ts";
import type { PipelineStatus } from "./pipeline-status.ts";

/** A status icon, with its own label. Without one, the icon's label for the status. */
interface RunStatus {
  status: PipelineStatus;
  label?: string;
}

interface PipelineRun {
  buildId: number;
  /** The run's number, such as a date with a counter, or null when only the check is known. */
  buildNumber: string | null;
  name: string;
  status: RunStatus | null;
  /** Queued or running, so it can be cancelled. A cancelling run is not busy. */
  isBusy: boolean;
  /** True or false for a current build check, null for an older run. */
  isRequired: boolean | null;
  /** When the run started, or was queued, as an ISO date. */
  startedAt: string | null;
}

const RESULT_STATUSES: Record<string, RunStatus> = {
  canceled: { label: "Canceled", status: "notStarted" },
  failed: { label: "Failed", status: "failed" },
  partiallySucceeded: { label: "Partly succeeded", status: "expired" },
  succeeded: { label: "Succeeded", status: "succeeded" },
};

const PROGRESS_STATUSES: Record<string, RunStatus> = {
  cancelling: { label: "Canceling", status: "running" },
  inProgress: { label: "Running", status: "running" },
  notStarted: { label: "Queued", status: "queued" },
  postponed: { label: "Queued", status: "queued" },
};

/** The run list's statuses of a run that waits or runs. */
const BUSY_BUILD_STATUSES = new Set(["inProgress", "notStarted", "postponed"]);

function buildStatusOf(build: PullRequestBuild): RunStatus | null {
  const finished = build.result === undefined ? undefined : RESULT_STATUSES[build.result];
  return finished ?? PROGRESS_STATUSES[build.status] ?? null;
}

function runOfBuild(build: PullRequestBuild, check: PipelineCheck | undefined): PipelineRun {
  return {
    buildId: build.id,
    buildNumber: build.buildNumber,
    isBusy: BUSY_BUILD_STATUSES.has(build.status),
    isRequired: check?.isRequired ?? null,
    name: check?.name ?? build.definition?.name ?? `Run ${build.buildNumber}`,
    startedAt: build.startTime ?? build.queueTime ?? check?.startedAt ?? null,
    status:
      check?.status === null || check === undefined
        ? buildStatusOf(build)
        : { status: check.status },
  };
}

function runOfCheck(check: PipelineCheck): PipelineRun {
  const status = check.status === null ? null : { status: check.status };
  const isBusy = check.status === "running" || check.status === "queued";
  return { ...check, buildNumber: null, isBusy, status };
}

/**
 * `builds` comes newest first from the builds API. A check whose run is not in it,
 * as when the run list could not load, goes first: a check is a current run.
 */
function pipelineRunsOf(checks: PipelineCheck[], builds: PullRequestBuild[]): PipelineRun[] {
  const listed = new Set(builds.map((build) => build.id));
  return [
    ...checks.filter((check) => !listed.has(check.buildId)).map((check) => runOfCheck(check)),
    ...builds.map((build) =>
      runOfBuild(
        build,
        checks.find((check) => check.buildId === build.id),
      ),
    ),
  ];
}

export type { PipelineRun, RunStatus };
export { pipelineRunsOf };
