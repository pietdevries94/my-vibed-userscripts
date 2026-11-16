import type { Feature } from "../core/feature.ts";
import { activityOrder } from "./activity-order/index.ts";
import { foldedPushes } from "./folded-pushes/index.ts";
import { joinedReviewerLines } from "./joined-reviewer-lines/index.ts";
import { overviewPipelineIssues } from "./overview-pipeline-issues/index.ts";

/** The features on a pull request's Overview, in the order the settings panel lists them. */
const OVERVIEW_FEATURES: Feature[] = [
  overviewPipelineIssues,
  activityOrder,
  foldedPushes,
  joinedReviewerLines,
];

export { OVERVIEW_FEATURES };
