import type { Feature } from "../core/feature.ts";
import { assignedToMeStacked } from "./assigned-to-me-stacked/index.ts";
import { greyDrafts } from "./grey-drafts/index.ts";
import { linkedWorkItem } from "./linked-work-item/index.ts";
import { oneLineRows } from "./one-line-rows/index.ts";
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
  greyDrafts,
  oneLineRows,
];

export { PULL_REQUEST_LIST_FEATURES };
