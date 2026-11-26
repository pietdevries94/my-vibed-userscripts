import type { Feature } from "../../core/feature.ts";
import { createDaysInColumn } from "./days-in-column.ts";
import { createDaysInColumnToggles } from "./days-in-column-toggle.ts";
import style from "./style.css";

const HIDDEN_COLUMNS_KEY = "days-in-column-hidden-columns";

const daysInColumn: Feature = {
  change: { kind: "new", version: "1.7.2" },
  description: "A dot per day a card has been in its column. Turn it on per column on the board.",
  id: "days-in-column",
  name: "Days in column",
  start({ client, document, now }) {
    const days = createDaysInColumn({ client, document, now });
    const toggles = createDaysInColumnToggles({
      document,
      storage: {
        load: () => GM_getValue<string[]>(HIDDEN_COLUMNS_KEY, []),
        save: (columnIds) => {
          GM_setValue(HIDDEN_COLUMNS_KEY, columnIds);
        },
      },
    });
    return {
      sync({ page, isTabActive }) {
        if (page.kind !== "board") {
          return;
        }
        toggles.sync();
        if (isTabActive) {
          void days.sync();
        }
      },
    };
  },
  styles: [style],
};

export { daysInColumn };
