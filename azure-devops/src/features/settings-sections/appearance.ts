import type { SettingsSection } from "../../core/feature.ts";
import { avatarInitials } from "../avatar-initials/index.ts";
import { followSystemTheme } from "../system-theme/index.ts";
import { windows98Mode } from "../windows-98-mode/index.ts";

const appearanceSection: SettingsSection = {
  description: "How Azure DevOps looks.",
  groups: [{ features: [followSystemTheme, avatarInitials, windows98Mode] }],
  name: "Appearance",
};

export { appearanceSection };
