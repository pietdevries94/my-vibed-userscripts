import { isWindows98Mode, showTableRows } from "./table-rows.ts";
import type { Feature } from "../../core/feature.ts";
import { createCreationDates } from "./creation-dates.ts";
import { findPullRequestRows } from "../../pull-requests/pr-list.ts";
import listSwitchStyle from "../../core/list-switch.css";
import { needsCreationDate } from "./table-age.ts";
import { showListSwitch } from "../../core/list-switch.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

/** The switch on the lists. On until the owner turns it off. */
const IS_TABLE_KEY = "table-rows-on";
const TABLE_SWITCH = { className: "fix-ado-table-switch", label: "Table" };

const tableRows: Feature = {
  change: { kind: "new", version: "1.28.0" },
  description:
    "The pull request lists as a table: a column each for the title, author, id, target, reviewers, comments and age, under a header, one 36px row per pull request. The age column shows when each pull request was created, updated and published. A Table switch on the lists flips between the table and Azure DevOps's two lines. Not in Windows 98 mode.",
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
        // Windows 98 mode lays the rows out itself, so there the switch does not show.
        isList =
          (page.kind === "pull-request-list" || page.kind === "pull-request-inbox") &&
          !isWindows98Mode(document);
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
