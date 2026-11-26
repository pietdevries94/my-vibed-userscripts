import type { Feature } from "../../core/feature.ts";
import { createViewedFiles } from "./viewed-files.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";

/** The safety cap on a wait for the file tree to draw. Each wait ends on the tree's change. */
const DRAW_TIMEOUT_MS = 2000;
/** The safety cap on a wait for the tree to show a tick it clicked: Azure DevOps may save it first. */
const TICK_TIMEOUT_MS = 10_000;

const viewedFiles: Feature = {
  change: { kind: "updated", version: "1.23.0" },
  description: "Tick a file as viewed, as on GitHub. Viewed files and folders collapse.",
  id: "viewed-files",
  name: "Viewed checkbox on files",
  start({ client, document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const viewed = createViewedFiles({
      client,
      document,
      drawTimeoutMs: DRAW_TIMEOUT_MS,
      tickTimeoutMs: TICK_TIMEOUT_MS,
    });
    return {
      sync({ page }) {
        viewed.sync(pullRequestOf(page));
      },
    };
  },
  styles: [style],
};

export { viewedFiles };
