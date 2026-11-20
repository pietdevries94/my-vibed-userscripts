import type { Feature } from "../../core/feature.ts";
import { createViewedFiles } from "./viewed-files.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";

/** How long the script waits for the file tree to draw after it scrolls or clicks it. */
const DRAW_TIMEOUT_MS = 300;

const viewedFiles: Feature = {
  change: { kind: "new", version: "1.21.0" },
  description:
    "A Viewed checkbox on each file in the Files tab ticks the file in the tree on the left, as on GitHub, and collapses its diff. A folder whose files are all ticked collapses in the tree.",
  id: "viewed-files",
  name: "Viewed files",
  start({ client, document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const viewed = createViewedFiles({ client, document, drawTimeoutMs: DRAW_TIMEOUT_MS });
    return {
      sync({ page }) {
        viewed.sync(pullRequestOf(page));
      },
    };
  },
  styles: [style],
};

export { viewedFiles };
