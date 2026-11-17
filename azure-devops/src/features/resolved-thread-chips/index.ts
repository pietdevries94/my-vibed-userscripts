import type { Feature } from "../../core/feature.ts";
import { createResolvedThreadChips } from "./resolved-thread-chips.ts";
import style from "./style.css";

const resolvedThreadChips: Feature = {
  change: { kind: "updated", version: "1.14.0" },
  description:
    "A Resolved chip on every resolved thread on a pull request's Overview, and an Unresolved chip on every active or pending one.",
  id: "resolved-thread-chips",
  name: "Resolved and Unresolved chips on threads",
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
