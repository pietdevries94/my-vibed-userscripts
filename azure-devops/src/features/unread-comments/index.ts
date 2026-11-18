import type { Feature } from "../../core/feature.ts";
import { createUnreadComments } from "./unread-comments.ts";
import style from "./style.css";

const unreadComments: Feature = {
  change: { kind: "new", version: "1.17.0" },
  description:
    "Unread comments on a pull request's Overview glow, one glow around comments that follow each other. Go to first unread, above the feed, and Go to next unread, on each group, scroll to them.",
  id: "unread-comments",
  name: "Unread comments",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const comments = createUnreadComments({ document });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          comments.sync();
        }
      },
    };
  },
  styles: [style],
};

export { unreadComments };
