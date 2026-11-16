import type { Feature } from "../core/feature.ts";
import { REVIEWING_FEATURES } from "./reviewing-features.ts";
import { activityOrder } from "./activity-order/index.ts";
import { avatarInitials } from "./avatar-initials/index.ts";
import { daysInColumn } from "./days-in-column/index.ts";
import { followSystemTheme } from "./system-theme/index.ts";
import { overviewPipelineIssues } from "./overview-pipeline-issues/index.ts";
import { pipelineStatusOnPullRequests } from "./pipeline-status/index.ts";
import { pipelineTab } from "./pipeline-tab/index.ts";
import { reloadOnChanges } from "./reload-on-changes/index.ts";

/** Every feature, in the order the settings panel lists them. */
const FEATURES: Feature[] = [
  pipelineStatusOnPullRequests,
  pipelineTab,
  overviewPipelineIssues,
  activityOrder,
  ...REVIEWING_FEATURES,
  avatarInitials,
  followSystemTheme,
  daysInColumn,
  reloadOnChanges,
];

export { FEATURES };
