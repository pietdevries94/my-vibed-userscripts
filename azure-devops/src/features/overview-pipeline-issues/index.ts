import type { Feature } from "../../core/feature.ts";
import { createOverviewPipelineIssues } from "./overview-pipeline-issues.ts";
import issueListStyle from "../../pipeline/pipeline-issue-list.css";
import { pullRequestOf } from "../../core/page.ts";

const overviewPipelineIssues: Feature = {
  change: { kind: "new", version: "1.7.2" },
  description: "Each check's warnings and errors above the description.",
  id: "overview-pipeline-issues",
  name: "Warnings and errors on the Overview",
  start({ basePath, client, document, isInFrame, now }) {
    if (isInFrame) {
      return null;
    }
    const issues = createOverviewPipelineIssues({
      apiBasePath: basePath,
      document,
      getEvaluations: async (pullRequest) => {
        const { evaluations } = await client.getPolicyEvaluations(pullRequest);
        return evaluations;
      },
      getTimeline: async (project, buildId) => {
        const { records } = await client.getTimeline(project, buildId);
        return records;
      },
      now,
    });
    return {
      sync({ page, isTabActive }) {
        issues.sync(pullRequestOf(page), isTabActive);
      },
    };
  },
  styles: [issueListStyle],
};

export { overviewPipelineIssues };
