import type { Feature } from "../../core/feature.ts";
import { createResolvedThreadChips } from "./resolved-thread-chips.ts";
import style from "./style.css";

const resolvedThreadChips: Feature = {
  change: { kind: "updated", version: "1.14.0" },
  description:
    "A chip with its status on every thread on a pull request's Overview: green for Resolved, orange for Active and Pending, grey for Won't fix and Closed.",
  id: "resolved-thread-chips",
  name: "Status chips on threads",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const chips = createResolvedThreadChips({ document });
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

export { resolvedThreadChips };
