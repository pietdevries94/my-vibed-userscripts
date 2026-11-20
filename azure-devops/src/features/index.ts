import type { Feature, FeatureCategory } from "../core/feature.ts";
import { CATEGORY_NAMES } from "./category-names.ts";
import type { CategoryName } from "./category-names.ts";
import { EVERYWHERE_FEATURES } from "./everywhere-features.ts";
import { OVERVIEW_FEATURES } from "./overview-features.ts";
import { PULL_REQUEST_FEATURES } from "./pull-request-features.ts";
import { daysInColumn } from "./days-in-column/index.ts";
import { pipelineStatusOnPullRequests } from "./pipeline-status/index.ts";
import { publishedSince } from "./published-since/index.ts";
import { requiredReviewers } from "./required-reviewers/index.ts";

/** The features under each heading of the settings panel. */
const FEATURES_BY_CATEGORY: Record<CategoryName, Feature[]> = {
  Boards: [daysInColumn],
  Everywhere: EVERYWHERE_FEATURES,
  "Pull request": PULL_REQUEST_FEATURES,
  "Pull request Overview": OVERVIEW_FEATURES,
  "Pull request lists": [pipelineStatusOnPullRequests, requiredReviewers, publishedSince],
};

/** Every feature, by the place in Azure DevOps where it shows, in the settings panel's order. */
const FEATURE_CATEGORIES: FeatureCategory[] = CATEGORY_NAMES.map((name) => ({
  features: FEATURES_BY_CATEGORY[name],
  name,
}));

/** Every feature, in the order they start. */
const FEATURES: Feature[] = FEATURE_CATEGORIES.flatMap((category) => category.features);

export { FEATURES, FEATURE_CATEGORIES };
