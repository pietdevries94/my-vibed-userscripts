import type { Feature } from "../core/feature.ts";
import { assignedToMeStacked } from "./assigned-to-me-stacked/index.ts";
import { linkedWorkItem } from "./linked-work-item/index.ts";
import { pipelineStatusOnPullRequests } from "./pipeline-status/index.ts";
import { publishedSince } from "./published-since/index.ts";
import { requiredReviewers } from "./required-reviewers/index.ts";

/** The features on the pull request lists and the inbox, in the order the settings panel lists them. */
const PULL_REQUEST_LIST_FEATURES: Feature[] = [
  pipelineStatusOnPullRequests,
  requiredReviewers,
  publishedSince,
  linkedWorkItem,
  assignedToMeStacked,
];

export { PULL_REQUEST_LIST_FEATURES };
