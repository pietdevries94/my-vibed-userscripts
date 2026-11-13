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

/** A build check that "Start new run" can re-queue. */
interface StartableCheck {
  evaluationId: string;
  name: string;
  isRequired: boolean;
}

function checkNameOf(evaluation: PolicyEvaluation, fallback: string): string {
  return (
    evaluation.configuration.settings?.displayName ??
    evaluation.context?.buildDefinitionName ??
    fallback
  );
}

function pipelineCheckOf(evaluation: PolicyEvaluation): PipelineCheck | null {
  const buildId = evaluation.context?.buildId ?? 0;
  // Right after a re-queue, the check has build id 0 until its run is made.
  if (evaluation.configuration.type.id !== BUILD_POLICY_TYPE_ID || buildId <= 0) {
    return null;
  }
  return {
    buildId,
    isRequired: evaluation.configuration.isBlocking,
    name: checkNameOf(evaluation, `Run ${buildId}`),
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

/** Every build check of the pull request, with or without a run, in Azure DevOps's order. */
function startableChecksOf(evaluations: PolicyEvaluation[]): StartableCheck[] {
  return evaluations.flatMap(({ evaluationId, ...evaluation }) =>
    evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID && evaluationId !== undefined
      ? [
          {
            evaluationId,
            isRequired: evaluation.configuration.isBlocking,
            name: checkNameOf(evaluation, "Build check"),
          },
        ]
      : [],
  );
}

export type { PipelineCheck, PullRequestBuild, StartableCheck };
export { pipelineChecksOf, startableChecksOf };
