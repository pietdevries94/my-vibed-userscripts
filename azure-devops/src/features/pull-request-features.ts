import type { Feature } from "../core/feature.ts";
import { pipelineTab } from "./pipeline-tab/index.ts";
import { review } from "./review/index.ts";
import { runPageTabs } from "./run-page-tabs/index.ts";
import { starredReviewers } from "./starred-reviewers/index.ts";

/** The features on every tab of a pull request, in the order the settings panel lists them. */
const PULL_REQUEST_FEATURES: Feature[] = [pipelineTab, runPageTabs, starredReviewers, review];

export { PULL_REQUEST_FEATURES };
