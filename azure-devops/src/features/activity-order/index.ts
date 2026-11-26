import type { ActivityOrder } from "./activity-order.ts";
import type { Feature } from "../../core/feature.ts";
import { createActivityOrder } from "./activity-order.ts";
import style from "./style.css";

const ORDER_KEY = "activity-order";

const activityOrder: Feature = {
  change: { kind: "new", version: "1.11.0" },
  description: "Comments and updates run from old to new. A button flips the order.",
  id: "activity-order",
  name: "Oldest first",
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
