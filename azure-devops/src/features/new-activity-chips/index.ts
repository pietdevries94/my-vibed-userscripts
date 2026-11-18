import type { Feature } from "../../core/feature.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import { createNewActivityChips } from "./new-activity-chips.ts";
import { createVisitStore } from "./visit-store.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";

/** A pull request the owner has not opened for 30 days loses its visit when the script starts. */
const MAX_VISIT_AGE_MS = 2_592_000_000;

const newActivityChips: Feature = {
  change: { kind: "new", version: "1.18.0" },
  description:
    "A New chip that glows on pushes, votes and other lines on a pull request's Overview that came after your last visit.",
  id: "new-activity-chips",
  name: "New chips on pushes and other changes",
  start({ basePath, document, isInFrame, now }) {
    if (isInFrame) {
      return null;
    }
    const visits = createVisitStore({
      keys: () => GM_listValues(),
      load: (key) => GM_getValue<unknown>(key, null),
      remove: (key) => {
        GM_deleteValue(key);
      },
      save: (key, visitedAt) => {
        GM_setValue(key, visitedAt);
      },
    });
    visits.deleteOlderThan(MAX_VISIT_AGE_MS, now());
    const chips = createNewActivityChips({ document, now, visits });
    const keyOf = ({ project, pullRequestId, repository }: PullRequestRef): string =>
      `${location.host}${basePath}/${project}/${repository}/${pullRequestId}`;
    // The owner leaves when the page goes, or when the tab goes to the background.
    globalThis.addEventListener("pagehide", chips.leave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        chips.leave();
      }
    });
    return {
      sync({ page }) {
        const pullRequest = pullRequestOf(page);
        chips.sync(pullRequest === null ? null : keyOf(pullRequest));
      },
    };
  },
  styles: [style],
};

export { newActivityChips };
