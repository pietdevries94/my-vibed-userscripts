import { BUILD_POLICY_TYPE_ID, pipelineStatusOf } from "./pipeline-status.ts";
import type { PipelineStatus, PolicyEvaluation } from "./pipeline-status.ts";

/** A pipeline run of a pull request, as the builds API gives it. */
interface PullRequestBuild {
  id: number;
  buildNumber: string;
  /** `notStarted`, `inProgress`, `completed`, … */
  status: string;
  /** `succeeded`, `partiallySucceeded`, `failed`, `canceled`, or absent while it runs. */
  result?: string;
  queueTime?: string;
  startTime?: string;
  definition?: { name?: string };
}

/** One build check of a pull request, with the run behind it. */
interface PipelineCheck {
  buildId: number;
  name: string;
  status: PipelineStatus | null;
  isRequired: boolean;
  /** When the run started, as an ISO date, or null when Azure DevOps does not tell. */
  startedAt: string | null;
}

function pipelineCheckOf(evaluation: PolicyEvaluation): PipelineCheck | null {
  const buildId = evaluation.context?.buildId ?? null;
  if (evaluation.configuration.type.id !== BUILD_POLICY_TYPE_ID || buildId === null) {
    return null;
  }
  return {
    buildId,
    isRequired: evaluation.configuration.isBlocking,
    name:
      evaluation.configuration.settings?.displayName ??
      evaluation.context?.buildDefinitionName ??
      `Run ${buildId}`,
    startedAt: evaluation.context?.buildStartedUtc ?? null,
    status: pipelineStatusOf([evaluation]),
  };
}

function startedAtMs(check: PipelineCheck): number {
  return check.startedAt === null ? 0 : Date.parse(check.startedAt);
}

/** The build checks that have a run, newest run first. */
function pipelineChecksOf(evaluations: PolicyEvaluation[]): PipelineCheck[] {
  return evaluations
    .map((evaluation) => pipelineCheckOf(evaluation))
    .filter((check) => check !== null)
    .toSorted((first, second) => startedAtMs(second) - startedAtMs(first));
}

export type { PipelineCheck, PullRequestBuild };
export { pipelineChecksOf };
