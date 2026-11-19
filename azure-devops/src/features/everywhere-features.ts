import type { Feature } from "../core/feature.ts";
import { avatarInitials } from "./avatar-initials/index.ts";
import { followSystemTheme } from "./system-theme/index.ts";
import { reloadOnChanges } from "./reload-on-changes/index.ts";
import { windows98Mode } from "./windows-98-mode/index.ts";

/** The features that show on every page, in the order the settings panel lists them. */
const EVERYWHERE_FEATURES: Feature[] = [
  avatarInitials,
  followSystemTheme,
  reloadOnChanges,
  windows98Mode,
];

export { EVERYWHERE_FEATURES };
