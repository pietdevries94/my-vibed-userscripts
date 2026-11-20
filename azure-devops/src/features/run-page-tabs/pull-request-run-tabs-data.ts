// Which run page tabs a pull request shows: each turned-on tab of a pipeline that is one
// of its build checks, on that pipeline's latest run there, or without a run yet.
import { BUILD_POLICY_TYPE_ID } from "../../pipeline/pipeline-status.ts";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import type { RunTab } from "./run-tab-store.ts";

/** A run page tab as a pull request shows it. */
interface PullRequestRunTab {
  /** Tells the tabs apart: the pipeline and the view. */
  key: string;
  /** The tab's label, with the pipeline's name when another tab has the same label. */
  name: string;
  tab: RunTab;
  /** The pipeline's latest run on the pull request, or null while it has none. */
  buildId: number | null;
}

function pipelineIdOf(evaluation: PolicyEvaluation): number | null {
  return (
    evaluation.configuration.settings?.buildDefinitionId ??
    evaluation.context?.buildDefinitionId ??
    null
  );
}

/** The build checks' pipelines, each with its check's run, or null without one. */
function checkRunsByPipeline(evaluations: PolicyEvaluation[]): Map<number, number | null> {
  const runs = new Map<number, number | null>();
  for (const evaluation of evaluations) {
    const pipelineId = pipelineIdOf(evaluation);
    if (evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID && pipelineId !== null) {
      const buildId = evaluation.context?.buildId ?? 0;
      runs.set(pipelineId, buildId > 0 ? buildId : (runs.get(pipelineId) ?? null));
    }
  }
  return runs;
}

/** The newest run of the pipeline: the highest build id, as Azure DevOps counts them up. */
function latestBuildId(
  pipelineId: number,
  checkRun: number | null,
  builds: PullRequestBuild[],
): number | null {
  const ids = builds.filter((build) => build.definition?.id === pipelineId).map(({ id }) => id);
  const all = checkRun === null ? ids : [...ids, checkRun];
  return all.length === 0 ? null : Math.max(...all);
}

function pullRequestRunTabsOf(
  tabs: RunTab[],
  evaluations: PolicyEvaluation[],
  builds: PullRequestBuild[],
): PullRequestRunTab[] {
  const checkRuns = checkRunsByPipeline(evaluations);
  const shown = tabs.filter((tab) => checkRuns.has(tab.pipelineId));
  return shown.map((tab) => {
    const isLabelShared = shown.some((other) => other !== tab && other.label === tab.label);
    return {
      buildId: latestBuildId(tab.pipelineId, checkRuns.get(tab.pipelineId) ?? null, builds),
      key: `${tab.pipelineId}/${tab.view}`,
      name: isLabelShared ? `${tab.label} (${tab.pipelineName})` : tab.label,
      tab,
    };
  });
}

export type { PullRequestRunTab };
export { pullRequestRunTabsOf };
