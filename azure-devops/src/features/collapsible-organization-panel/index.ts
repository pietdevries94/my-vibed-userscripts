import type { Feature } from "../../core/feature.ts";
import { createOrganizationPanel } from "./organization-panel.ts";
import style from "./style.css";

const IS_COLLAPSED_KEY = "organization-panel-collapsed";

const collapsibleOrganizationPanel: Feature = {
  change: { kind: "new", version: "1.30.0" },
  description:
    "A button collapses the side panel of the inbox, Work and the organization's home to its icons, as on a project. It stays collapsed.",
  id: "collapsible-organization-panel",
  name: "Collapsible organization panel",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const panel = createOrganizationPanel({
      document,
      load: () => GM_getValue<boolean>(IS_COLLAPSED_KEY, false),
      save: (isCollapsed) => {
        GM_setValue(IS_COLLAPSED_KEY, isCollapsed);
      },
    });
    return {
      sync() {
        panel.sync();
      },
    };
  },
  styles: [style],
};

export { collapsibleOrganizationPanel };
