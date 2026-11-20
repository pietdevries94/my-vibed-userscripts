import type { Feature } from "../../core/feature.ts";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import style from "./style.css";

const collapsibleThreads: Feature = {
  change: { kind: "updated", version: "1.17.0" },
  description:
    "A button on every thread on a pull request's Overview collapses it. Resolved threads start collapsed, unless one of their comments is unread. Above the feed, Expand all threads opens every thread, Collapse all threads collapses every thread, and Collapse done threads collapses resolved ones and opens the others, also ones that load later. Each shows only while it would change a thread.",
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
