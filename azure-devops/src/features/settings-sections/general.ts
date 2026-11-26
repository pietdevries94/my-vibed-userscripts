import type { SettingsSection } from "../../core/feature.ts";
import { reloadOnChanges } from "../reload-on-changes/index.ts";

const generalSection: SettingsSection = {
  description: "How the script behaves on every page.",
  groups: [{ features: [reloadOnChanges] }],
  name: "General",
};

export { generalSection };
