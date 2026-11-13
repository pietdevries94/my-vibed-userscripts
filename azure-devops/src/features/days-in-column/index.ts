import type { Feature } from "../../core/feature.ts";
import { createDaysInColumn } from "../../days-in-column.ts";
import { createDaysInColumnToggles } from "../../days-in-column-toggle.ts";

const HIDDEN_COLUMNS_KEY = "days-in-column-hidden-columns";

const daysInColumn: Feature = {
  description: "A dot per day a card has been in its board column, with a toggle per column.",
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
};

export { daysInColumn };
