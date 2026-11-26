import { createReviewStore, reviewKey } from "./review-store.ts";
import type { Feature } from "../../core/feature.ts";
import type { Review } from "./review-store.ts";
import { createReview } from "./review.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";

/** A review nobody touched for 30 days is deleted when the script starts. */
const MAX_REVIEW_AGE_MS = 2_592_000_000;

const review: Feature = {
  change: { kind: "new", version: "1.10.0" },
  description: "Collect comments only you see, then post them together with your vote.",
  id: "review",
  name: "Reviews",
  start({ basePath, client, document, isInFrame, now }) {
    if (isInFrame) {
      return null;
    }
    const store = createReviewStore({
      createId: () => crypto.randomUUID(),
      now,
      storage: {
        keys: () => GM_listValues(),
        load: (key) => GM_getValue<unknown>(key, null),
        remove: (key) => {
          GM_deleteValue(key);
        },
        save: (key, stored: Review) => {
          GM_setValue(key, stored);
        },
      },
    });
    store.deleteOlderThan(MAX_REVIEW_AGE_MS);
    const feature = createReview({
      client,
      // oxlint-disable-next-line eslint/no-alert -- one question before the owner's text is deleted
      confirm: (question) => globalThis.confirm(question),
      copy: (text) => {
        void navigator.clipboard.writeText(text);
      },
      document,
      keyOf: (pullRequest) => reviewKey(`${location.host}${basePath}`, pullRequest),
      reload: () => {
        location.reload();
      },
      store,
    });
    return {
      sync({ page }) {
        feature.sync(pullRequestOf(page));
      },
    };
  },
  styles: [style],
};

export { review };
