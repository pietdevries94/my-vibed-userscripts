import { isWindows98Mode, showOneLineRows } from "./one-line-rows.ts";
import type { Feature } from "../../core/feature.ts";
import listSwitchStyle from "../../core/list-switch.css";
import { showListSwitch } from "../../core/list-switch.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

/** The switch on the lists. Off until the owner turns it on. */
const IS_ONE_LINE_KEY = "one-line-rows-on";
const ONE_LINE_SWITCH = { className: "fix-ado-one-line-switch", label: "One line" };

const oneLineRows: Feature = {
  change: { kind: "new", version: "1.27.0" },
  description:
    "Each pull request in a list on one line, so more of them fit on the screen. A One line switch on the lists flips between one line and Azure DevOps's two. Not in Windows 98 mode.",
  id: "one-line-rows",
  name: "Pull requests on one line",
  start({ document }) {
    let isOneLine = GM_getValue<boolean>(IS_ONE_LINE_KEY, false);
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
        // Windows 98 mode lays the rows out itself, so there the switch does not show.
        isList =
          (page.kind === "pull-request-list" || page.kind === "pull-request-inbox") &&
          !isWindows98Mode(document);
        show();
      },
    };
  },
  styles: [switchStyle, listSwitchStyle, style],
};

export { oneLineRows };
