import type { Feature } from "../../core/feature.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { createStarredReviewerChips } from "./starred-reviewer-chips.ts";
import { createStarredReviewers } from "./starred-reviewers.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import { onNextDomChange } from "../../core/next-dom-change.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";

function schedule(callback: () => void, delayMs: number): () => void {
  const timer = setTimeout(callback, delayMs);
  return () => {
    clearTimeout(timer);
  };
}

const starredReviewers: Feature = {
  change: { kind: "updated", version: "1.9.0" },
  description: "Add a starred reviewer in one click, also on a new pull request.",
  id: "starred-reviewers",
  name: "Starred reviewers",
  start({ basePath, client, document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    // One starred list per organisation.
    const storageKey = `starred-reviewers:${location.host}${basePath}`;
    const imageUrlOf = ({ id }: Identity): string =>
      `${location.origin}${basePath}/_api/_common/identityImage?id=${encodeURIComponent(id)}`;
    const store = createStarredReviewersStore({
      load: () => GM_getValue<unknown>(storageKey, []),
      save: (list) => {
        GM_setValue(storageKey, list);
      },
    });
    const starred = createStarredReviewers({
      client,
      document,
      imageUrlOf,
      reload: () => {
        location.reload();
      },
      schedule,
      store,
    });
    const chips = createStarredReviewerChips({
      document,
      imageUrlOf,
      onNextDomChange: (callback) => onNextDomChange(document, callback),
      schedule,
      store,
    });
    return {
      sync({ page }) {
        starred.sync(pullRequestOf(page));
        chips.sync(page.kind === "pull-request-create");
      },
    };
  },
  styles: [style],
};

export { starredReviewers };
