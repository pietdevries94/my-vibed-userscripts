import type { Feature } from "../../core/feature.ts";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import style from "./style.css";

const collapsibleThreads: Feature = {
  change: { kind: "updated", version: "1.22.0" },
  description:
    "A button on every thread on a pull request's Overview collapses it. Resolved, Won't fix and Closed threads start collapsed, unless one of their comments is unread. Above the feed, Collapse all threads collapses every thread and turns into Expand all threads. Collapse done threads collapses the done ones, opens the others and turns into Expand done threads, which opens the done ones only. Both also apply to threads that load later.",
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
