import { findPullRequestRows, showPipelineStatus } from "../../pull-requests/pr-list.ts";
import type { Feature } from "../../core/feature.ts";
import { createPipelineStatusPoller } from "./pipeline-status-poller.ts";
import statusIconStyle from "../../pipeline/pipeline-status-icon.css";

const pipelineStatusOnPullRequests: Feature = {
  description: "A pipeline status icon on each pull request in a list.",
  id: "pipeline-status",
  name: "Pipeline status on pull requests",
  start({ basePath, client, document, now }) {
    const poller = createPipelineStatusPoller<HTMLElement>({
      client,
      findRows: () => findPullRequestRows(document, basePath),
      now,
      showStatus: showPipelineStatus,
    });
    return {
      sync({ isTabActive }) {
        if (isTabActive) {
          void poller.sync();
        }
      },
    };
  },
  styles: [statusIconStyle],
};

export { pipelineStatusOnPullRequests };
