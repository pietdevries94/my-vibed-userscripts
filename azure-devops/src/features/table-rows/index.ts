import type { Feature } from "../../core/feature.ts";
import { createCreationDates } from "./creation-dates.ts";
import { findPullRequestRows } from "../../pull-requests/pr-list.ts";
import listSwitchStyle from "../../core/list-switch.css";
import { needsCreationDate } from "./table-age.ts";
import { showListSwitch } from "../../core/list-switch.ts";
import { showTableRows } from "./table-rows.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

/** The switch on the lists. On until the owner turns it off. */
const IS_TABLE_KEY = "table-rows-on";
const TABLE_SWITCH = { className: "fix-ado-table-switch", label: "Table" };

const tableRows: Feature = {
  change: { kind: "updated", version: "1.31.0" },
  description:
    "A column per field and one row per pull request. A Table switch on the lists flips it.",
  id: "table-rows",
  name: "Pull requests as a table",
  start({ basePath, client, document, now }) {
    let isTable = GM_getValue<boolean>(IS_TABLE_KEY, true);
    let isList = false;
    const creationDates = createCreationDates({ client, now });

    function show(): void {
      showTableRows(document, isList && isTable, {
        createdAt: creationDates.createdAt,
        now: now(),
      });
      showListSwitch(document, TABLE_SWITCH, isList ? { isOn: isTable, onToggle: toggle } : null);
    }

    function toggle(): void {
      isTable = !isTable;
      GM_setValue(IS_TABLE_KEY, isTable);
      show();
    }

    return {
      sync({ page, isTabActive }) {
        isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox";
        show();
        if (isList && isTable && isTabActive) {
          const undated = findPullRequestRows(document, basePath).filter(({ row }) =>
            needsCreationDate(row),
          );
          void creationDates.sync(undated.map(({ pullRequest }) => pullRequest)).then(show);
        }
      },
    };
  },
  styles: [switchStyle, listSwitchStyle, style],
};

export { tableRows };
