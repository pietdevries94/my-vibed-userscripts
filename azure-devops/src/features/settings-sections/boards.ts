import type { SettingsSection } from "../../core/feature.ts";
import { daysInColumn } from "../days-in-column/index.ts";

const boardsSection: SettingsSection = {
  description: "Work item boards.",
  groups: [{ features: [daysInColumn] }],
  name: "Boards",
};

export { boardsSection };
