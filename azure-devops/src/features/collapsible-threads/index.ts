import type { Feature } from "../../core/feature.ts";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import style from "./style.css";

const collapsibleThreads: Feature = {
  change: { kind: "new", version: "1.12.0" },
  description:
    "A button on every thread on a pull request's Overview collapses it. Resolved threads start collapsed.",
  id: "collapsible-threads",
  name: "Collapsible threads",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const threads = createCollapsibleThreads({ document });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          threads.sync();
        }
      },
    };
  },
  styles: [style],
};

export { collapsibleThreads };
