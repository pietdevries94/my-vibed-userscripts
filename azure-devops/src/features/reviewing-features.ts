import type { Feature } from "../core/feature.ts";
import { requiredReviewers } from "./required-reviewers/index.ts";
import { review } from "./review/index.ts";
import { starredReviewers } from "./starred-reviewers/index.ts";

/** The features for reviewing a pull request, in the order the settings panel lists them. */
const REVIEWING_FEATURES: Feature[] = [requiredReviewers, starredReviewers, review];

export { REVIEWING_FEATURES };
