import type { Feature } from "../../core/feature.ts";
import { createJoinedReviewerLines } from "./joined-reviewer-lines.ts";
import style from "./style.css";

const joinedReviewerLines: Feature = {
  change: { kind: "new", version: "1.12.0" },
  description: "Lines that add reviewers become one line.",
  id: "joined-reviewer-lines",
  name: "Join reviewer lines",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const lines = createJoinedReviewerLines({ document });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          lines.sync();
        }
      },
    };
  },
  styles: [style],
};

export { joinedReviewerLines };
