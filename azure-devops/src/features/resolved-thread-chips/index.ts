import type { Feature } from "../../core/feature.ts";
import { createResolvedThreadChips } from "./resolved-thread-chips.ts";
import style from "./style.css";

const resolvedThreadChips: Feature = {
  change: { kind: "updated", version: "1.22.0" },
  description: "Green for Resolved, orange for Active, grey for Won't fix and Closed.",
  id: "resolved-thread-chips",
  name: "Status chips",
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
