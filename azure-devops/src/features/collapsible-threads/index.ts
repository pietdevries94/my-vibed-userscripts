import type { Feature } from "../../core/feature.ts";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import style from "./style.css";

const collapsibleThreads: Feature = {
  change: { kind: "updated", version: "1.22.0" },
  description:
    "Done threads start collapsed, unless a comment is unread. Buttons collapse or expand them all.",
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
