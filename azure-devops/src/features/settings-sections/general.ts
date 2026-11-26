import type { SettingsSection } from "../../core/feature.ts";
import { collapsibleOrganizationPanel } from "../collapsible-organization-panel/index.ts";
import { reloadOnChanges } from "../reload-on-changes/index.ts";

const generalSection: SettingsSection = {
  description: "How the script behaves on every page.",
  groups: [{ features: [reloadOnChanges, collapsibleOrganizationPanel] }],
  name: "General",
};

export { generalSection };
