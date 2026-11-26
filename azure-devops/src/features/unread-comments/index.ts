import type { Feature } from "../../core/feature.ts";
import { createUnreadComments } from "./unread-comments.ts";
import style from "./style.css";

const unreadComments: Feature = {
  change: { kind: "new", version: "1.17.0" },
  description: "Unread comments glow, with buttons to the first and next one.",
  id: "unread-comments",
  name: "Highlight unread comments",
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
