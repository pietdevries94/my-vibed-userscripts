import type { SettingsSection } from "../../core/feature.ts";
import { review } from "../review/index.ts";
import { starredReviewers } from "../starred-reviewers/index.ts";
import { viewedFiles } from "../viewed-files/index.ts";

const codeReviewSection: SettingsSection = {
  description: "Reviewing files and adding reviewers.",
  groups: [{ features: [review, viewedFiles, starredReviewers] }],
  name: "Code review",
};

export { codeReviewSection };
