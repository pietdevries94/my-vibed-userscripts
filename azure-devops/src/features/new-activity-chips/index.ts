import type { Feature } from "../../core/feature.ts";
import { createNewActivityChips } from "./new-activity-chips.ts";
import style from "./style.css";

const newActivityChips: Feature = {
  change: { kind: "new", version: "1.18.0" },
  description:
    "A New chip that glows on pushes, votes and other lines on a pull request's Overview that you have not seen yet.",
  id: "new-activity-chips",
  name: "New chips on pushes and other changes",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const chips = createNewActivityChips({ document });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          chips.sync();
        }
      },
    };
  },
  styles: [style],
};

export { newActivityChips };
