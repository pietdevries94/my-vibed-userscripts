import type { SettingsSection } from "../../core/feature.ts";
import { assignedToMeStacked } from "../assigned-to-me-stacked/index.ts";
import { linkedWorkItem } from "../linked-work-item/index.ts";
import { publishedSince } from "../published-since/index.ts";
import { requiredReviewers } from "../required-reviewers/index.ts";
import { tableRows } from "../table-rows/index.ts";

const pullRequestListsSection: SettingsSection = {
  description: "The lists of pull requests and the Assigned to me card.",
  groups: [
    {
      features: [requiredReviewers, publishedSince, linkedWorkItem, assignedToMeStacked, tableRows],
    },
  ],
  name: "Pull request lists",
};

export { pullRequestListsSection };
