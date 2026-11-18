import type { Feature, FeatureCategory } from "../core/feature.ts";
import { OVERVIEW_FEATURES } from "./overview-features.ts";
import { PULL_REQUEST_FEATURES } from "./pull-request-features.ts";
import { avatarInitials } from "./avatar-initials/index.ts";
import { daysInColumn } from "./days-in-column/index.ts";
import { followSystemTheme } from "./system-theme/index.ts";
import { pipelineStatusOnPullRequests } from "./pipeline-status/index.ts";
import { publishedSince } from "./published-since/index.ts";
import { reloadOnChanges } from "./reload-on-changes/index.ts";
import { requiredReviewers } from "./required-reviewers/index.ts";

/** Every feature, by the place in Azure DevOps where it shows, in the settings panel's order. */
const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    features: [pipelineStatusOnPullRequests, requiredReviewers, publishedSince],
    name: "Pull request lists",
  },
  { features: PULL_REQUEST_FEATURES, name: "Pull request" },
  { features: OVERVIEW_FEATURES, name: "Pull request Overview" },
  { features: [daysInColumn], name: "Boards" },
  { features: [avatarInitials, followSystemTheme, reloadOnChanges], name: "Everywhere" },
];

/** Every feature, in the order they start. */
const FEATURES: Feature[] = FEATURE_CATEGORIES.flatMap((category) => category.features);

export { FEATURES, FEATURE_CATEGORIES };
