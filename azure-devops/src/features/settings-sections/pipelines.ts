import type { SettingsSection } from "../../core/feature.ts";
import { overviewPipelineIssues } from "../overview-pipeline-issues/index.ts";
import { pipelineStatusOnPullRequests } from "../pipeline-status/index.ts";
import { pipelineTab } from "../pipeline-tab/index.ts";
import { runPageTabs } from "../run-page-tabs/index.ts";

const pipelinesSection: SettingsSection = {
  description: "Pipeline runs, wherever they show.",
  groups: [
    { features: [pipelineStatusOnPullRequests], name: "Pull request lists" },
    { features: [overviewPipelineIssues, pipelineTab, runPageTabs], name: "Pull request" },
  ],
  name: "Pipelines",
};

export { pipelinesSection };
