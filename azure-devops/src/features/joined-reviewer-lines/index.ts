import type { Feature } from "../../core/feature.ts";
import { createJoinedReviewerLines } from "./joined-reviewer-lines.ts";
import style from "./style.css";

const joinedReviewerLines: Feature = {
  change: { kind: "new", version: "1.12.0" },
  description:
    "Lines next to each other on a pull request's Overview that add a reviewer are one line, with required and optional reviewers grouped.",
  id: "joined-reviewer-lines",
  name: "Joined reviewer lines",
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
