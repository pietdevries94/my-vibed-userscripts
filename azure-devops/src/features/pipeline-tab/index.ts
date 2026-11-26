import type { Feature } from "../../core/feature.ts";
import { createPipelineRunFrame } from "./pipeline-run-frame.ts";
import { createPipelineTab } from "./pipeline-tab.ts";
import issueListStyle from "../../pipeline/pipeline-issue-list.css";
import { pullRequestOf } from "../../core/page.ts";
import statusIconStyle from "../../pipeline/pipeline-status-icon.css";
import style from "./style.css";

const pipelineTab: Feature = {
  change: { kind: "new", version: "1.7.2" },
  description: "Runs, stages, steps and logs, with buttons to start or cancel a run.",
  id: "pipeline-tab",
  name: "Pipeline tab",
  start({ basePath, client, document, isInFrame, now }) {
    // In its frame, the tab shows a run page. The script strips that page to its log.
    if (isInFrame) {
      const runFrame = createPipelineRunFrame(document);
      return runFrame
        ? {
            sync() {
              runFrame.sync();
            },
          }
        : null;
    }
    const tab = createPipelineTab({
      apiBasePath: basePath,
      cancelRun: async (project, buildId) => {
        await client.cancelBuild(project, buildId);
      },
      document,
      getEvaluations: async (pullRequest) => {
        const { evaluations } = await client.getPolicyEvaluations(pullRequest);
        return evaluations;
      },
      getPullRequestBuilds: async ({ project, pullRequestId }) => {
        const { builds } = await client.getPullRequestBuilds(project, pullRequestId);
        return builds;
      },
      getTimeline: async (project, buildId) => {
        const { records } = await client.getTimeline(project, buildId);
        return records;
      },
      now,
      requeueCheck: async ({ project }, evaluationId) => {
        await client.requeuePolicyEvaluation(project, evaluationId);
      },
    });
    return {
      sync({ page }) {
        tab.sync(pullRequestOf(page));
      },
    };
  },
  styles: [issueListStyle, statusIconStyle, style],
};

export { pipelineTab };
