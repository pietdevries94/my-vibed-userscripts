import type { Feature, SettingsSection } from "../core/feature.ts";
import { SECTION_NAMES } from "./section-names.ts";
import type { SectionName } from "./section-names.ts";
import { appearanceSection } from "./settings-sections/appearance.ts";
import { boardsSection } from "./settings-sections/boards.ts";
import { codeReviewSection } from "./settings-sections/code-review.ts";
import { commentsAndActivitySection } from "./settings-sections/comments-and-activity.ts";
import { generalSection } from "./settings-sections/general.ts";
import { pipelinesSection } from "./settings-sections/pipelines.ts";
import { pullRequestListsSection } from "./settings-sections/pull-request-lists.ts";

const SECTIONS_BY_NAME: Record<SectionName, SettingsSection> = {
  Appearance: appearanceSection,
  Boards: boardsSection,
  "Code review": codeReviewSection,
  "Comments and activity": commentsAndActivitySection,
  General: generalSection,
  Pipelines: pipelinesSection,
  "Pull request lists": pullRequestListsSection,
};

/** The settings panel's sections, in its side bar's order. */
const SETTINGS_SECTIONS: SettingsSection[] = SECTION_NAMES.map((name) => SECTIONS_BY_NAME[name]);

// The order features start and sync in, by id: the order from before the panel had sections,
// so features that change the same part of a page keep taking turns as before.
const START_ORDER = [
  "pipeline-status",
  "required-reviewers",
  "published-since",
  "linked-work-item",
  "assigned-to-me-stacked",
  "table-rows",
  "pipeline-tab",
  "run-page-tabs",
  "starred-reviewers",
  "review",
  "viewed-files",
  "overview-pipeline-issues",
  "activity-order",
  "scroll-to-bottom",
  "folded-pushes",
  "joined-reviewer-lines",
  "resolved-thread-chips",
  "collapsible-threads",
  "unread-comments",
  "new-activity-chips",
  "days-in-column",
  "avatar-initials",
  "follow-system-theme",
  "reload-on-changes",
  "windows-98-mode",
];

/** A feature missing from START_ORDER starts last. */
const startRank = ({ id }: Feature): number => {
  const rank = START_ORDER.indexOf(id);
  return rank === -1 ? START_ORDER.length : rank;
};

/** Every feature, in the order they start. */
const FEATURES: Feature[] = SETTINGS_SECTIONS.flatMap((section) =>
  section.groups.flatMap((group) => group.features),
).toSorted((first, second) => startRank(first) - startRank(second));

export { FEATURES, SETTINGS_SECTIONS };
