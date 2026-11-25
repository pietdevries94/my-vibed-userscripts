import type { Feature } from "../../core/feature.ts";
import listSwitchStyle from "../../core/list-switch.css";
import { showListSwitch } from "../../core/list-switch.ts";
import { showOneLineRows } from "./one-line-rows.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

/** The switch on the lists. On when the feature is first turned on, so its rows show at once. */
const IS_ONE_LINE_KEY = "one-line-rows-on";
const ONE_LINE_SWITCH = { className: "fix-ado-one-line-switch", label: "One line" };

const oneLineRows: Feature = {
  change: { kind: "new", version: "1.26.0" },
  description:
    "Each pull request in a list on one line, so more of them fit on the screen. A One line switch on the lists flips between one line and Azure DevOps's two.",
  id: "one-line-rows",
  isOffByDefault: true,
  name: "Pull requests on one line",
  start({ document }) {
    let isOneLine = GM_getValue<boolean>(IS_ONE_LINE_KEY, true);
    let isList = false;

    function show(): void {
      showOneLineRows(document, isList && isOneLine);
      showListSwitch(
        document,
        ONE_LINE_SWITCH,
        isList ? { isOn: isOneLine, onToggle: toggle } : null,
      );
    }

    function toggle(): void {
      isOneLine = !isOneLine;
      GM_setValue(IS_ONE_LINE_KEY, isOneLine);
      show();
    }

    return {
      sync({ page }) {
        isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox";
        show();
      },
    };
  },
  styles: [switchStyle, listSwitchStyle, style],
};

export { oneLineRows };
