import type { ActivityOrder } from "./activity-order.ts";
import type { Feature } from "../../core/feature.ts";
import { createActivityOrder } from "./activity-order.ts";
import style from "./style.css";

const ORDER_KEY = "activity-order";

const activityOrder: Feature = {
  change: { kind: "new", version: "1.11.0" },
  description:
    "The comments and updates on a pull request's Overview run from old to new, with a button to flip them.",
  id: "activity-order",
  name: "Oldest first on the Overview",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const order = createActivityOrder({
      document,
      storage: {
        load: () => GM_getValue<ActivityOrder | null>(ORDER_KEY, null),
        save: (picked) => {
          GM_setValue(ORDER_KEY, picked);
        },
      },
    });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          order.sync();
        }
      },
    };
  },
  styles: [style],
};

export { activityOrder };
