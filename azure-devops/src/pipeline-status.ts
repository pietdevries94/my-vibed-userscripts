export const BUILD_POLICY_TYPE_ID = "0609b952-1397-4640-95ec-e00a01b2c241";

export interface PolicyEvaluation {
  status: string;
  configuration: { isBlocking: boolean; type: { id: string } };
  context?: { buildId?: number; isExpired?: boolean } | null;
}

export type PipelineStatus = "succeeded" | "failed" | "running" | "queued" | "notStarted" | "expired";

/**
 * One status for all build validation policies of a pull request.
 * Required policies decide when there are any. Returns null when the pull
 * request has no build validation.
 */
export function pipelineStatusOf(evaluations: PolicyEvaluation[]): PipelineStatus | null {
  const buildEvaluations = evaluations.filter((evaluation) => evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID);
  const requiredBuildEvaluations = buildEvaluations.filter((evaluation) => evaluation.configuration.isBlocking);
  const decisiveEvaluations = requiredBuildEvaluations.length > 0 ? requiredBuildEvaluations : buildEvaluations;
  const hasStatus = (status: string) => decisiveEvaluations.some((evaluation) => evaluation.status === status);

  if (hasStatus("rejected") || hasStatus("broken")) return "failed";
  if (hasStatus("running")) return "running";
  if (decisiveEvaluations.some((evaluation) => evaluation.context?.isExpired)) return "expired";
  if (decisiveEvaluations.some((evaluation) => evaluation.status === "queued" && evaluation.context?.buildId != null)) return "queued";
  if (hasStatus("queued")) return "notStarted";
  if (hasStatus("approved")) return "succeeded";
  return null;
}

export function isInProgress(status: PipelineStatus | null): boolean {
  return status === "running" || status === "queued";
}
