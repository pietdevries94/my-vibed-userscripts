import type { Feature } from "../../core/feature.ts";
import { createFoldedPushes } from "./folded-pushes.ts";
import style from "./style.css";

const foldedPushes: Feature = {
  change: { kind: "new", version: "1.12.0" },
  description:
    "A push on a pull request's Overview is one line, like its other updates, with a button that shows its commits.",
  id: "folded-pushes",
  name: "Folded pushes",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const pushes = createFoldedPushes({ document });
    return {
      sync({ page }) {
        if (page.kind === "pull-request") {
          pushes.sync();
        }
      },
    };
  },
  styles: [style],
};

export { foldedPushes };
