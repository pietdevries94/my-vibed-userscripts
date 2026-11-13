import type { Feature } from "../../core/feature.ts";
import { createStarredReviewers } from "../../starred-reviewers.ts";
import { createStarredReviewersStore } from "../../starred-reviewers-store.ts";
import { pullRequestOf } from "../../core/page.ts";

const starredReviewers: Feature = {
  description:
    "Star reviewers, then add a starred one as optional or required reviewer in one click.",
  id: "starred-reviewers",
  name: "Starred reviewers",
  start({ basePath, client, document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    // One starred list per organisation.
    const storageKey = `starred-reviewers:${location.host}${basePath}`;
    const starred = createStarredReviewers({
      client,
      document,
      imageUrlOf: ({ id }) =>
        `${location.origin}${basePath}/_api/_common/identityImage?id=${encodeURIComponent(id)}`,
      reload: () => {
        location.reload();
      },
      schedule: (callback, delayMs): (() => void) => {
        const timer = setTimeout(callback, delayMs);
        return () => {
          clearTimeout(timer);
        };
      },
      store: createStarredReviewersStore({
        load: () => GM_getValue<unknown>(storageKey, []),
        save: (list) => {
          GM_setValue(storageKey, list);
        },
      }),
    });
    return {
      sync({ page }) {
        starred.sync(pullRequestOf(page));
      },
    };
  },
};

export { starredReviewers };
