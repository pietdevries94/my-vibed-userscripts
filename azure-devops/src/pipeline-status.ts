const BUILD_POLICY_TYPE_ID = "0609b952-1397-4640-95ec-e00a01b2c241";

interface PolicyEvaluation {
  status: string;
  configuration: { isBlocking: boolean; type: { id: string } };
  context?: { buildId?: number; isExpired?: boolean } | null;
}

type PipelineStatus = "succeeded" | "failed" | "running" | "queued" | "notStarted" | "expired";

function hasStatus(evaluations: PolicyEvaluation[], status: string): boolean {
  return evaluations.some((evaluation) => evaluation.status === status);
}

/** The first rule that matches the decisive evaluations gives the status. */
const STATUS_RULES: [PipelineStatus, (evaluations: PolicyEvaluation[]) => boolean][] = [
  [
    "failed",
    (evaluations) => hasStatus(evaluations, "rejected") || hasStatus(evaluations, "broken"),
  ],
  ["running", (evaluations) => hasStatus(evaluations, "running")],
  [
    "expired",
    (evaluations) => evaluations.some((evaluation) => Boolean(evaluation.context?.isExpired)),
  ],
  [
    "queued",
    (evaluations) =>
      evaluations.some(
        (evaluation) =>
          evaluation.status === "queued" && (evaluation.context?.buildId ?? null) !== null,
      ),
  ],
  ["notStarted", (evaluations) => hasStatus(evaluations, "queued")],
  ["succeeded", (evaluations) => hasStatus(evaluations, "approved")],
];

/**
 * One status for all build validation policies of a pull request.
 * Required policies decide when there are any. Returns null when the pull
 * request has no build validation.
 */
function pipelineStatusOf(evaluations: PolicyEvaluation[]): PipelineStatus | null {
  const buildEvaluations = evaluations.filter(
    (evaluation) => evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID,
  );
  const requiredBuildEvaluations = buildEvaluations.filter(
    (evaluation) => evaluation.configuration.isBlocking,
  );
  const decisiveEvaluations =
    requiredBuildEvaluations.length > 0 ? requiredBuildEvaluations : buildEvaluations;
  return STATUS_RULES.find(([, matches]) => matches(decisiveEvaluations))?.[0] ?? null;
}

function isInProgress(status: PipelineStatus | null): boolean {
  return status === "running" || status === "queued";
}

export type { PipelineStatus, PolicyEvaluation };
export { BUILD_POLICY_TYPE_ID, isInProgress, pipelineStatusOf };
