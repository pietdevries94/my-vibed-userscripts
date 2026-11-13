import type { Feature } from "../core/feature.ts";
import { avatarInitials } from "./avatar-initials/index.ts";
import { daysInColumn } from "./days-in-column/index.ts";
import { followSystemTheme } from "./system-theme/index.ts";
import { overviewPipelineIssues } from "./overview-pipeline-issues/index.ts";
import { pipelineStatusOnPullRequests } from "./pipeline-status/index.ts";
import { pipelineTab } from "./pipeline-tab/index.ts";
import { reloadOnChanges } from "./reload-on-changes/index.ts";
import { requiredReviewers } from "./required-reviewers/index.ts";
import { starredReviewers } from "./starred-reviewers/index.ts";

/** Every feature, in the order the settings panel lists them. */
const FEATURES: Feature[] = [
  pipelineStatusOnPullRequests,
  pipelineTab,
  overviewPipelineIssues,
  requiredReviewers,
  starredReviewers,
  avatarInitials,
  followSystemTheme,
  daysInColumn,
  reloadOnChanges,
];

export { FEATURES };
