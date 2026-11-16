// A review store on a map, for tests. Test code only.
import type { ReviewStorage, ReviewStore } from "./review-store.ts";
import { createReviewStore } from "./review-store.ts";

interface TestReviewStore {
  store: ReviewStore;
  stored: Map<string, unknown>;
  clock: { now: number };
}

function createTestReviewStore(): TestReviewStore {
  const stored = new Map<string, unknown>();
  const clock = { now: 0 };
  let createdIds = 0;
  const storage: ReviewStorage = {
    keys: () => [...stored.keys()],
    load: (key) => stored.get(key),
    remove: (key) => {
      stored.delete(key);
    },
    save: (key, review) => {
      stored.set(key, structuredClone(review));
    },
  };
  const store = createReviewStore({
    createId: () => {
      createdIds += 1;
      return `comment-${createdIds}`;
    },
    now: () => clock.now,
    storage,
  });
  return { clock, store, stored };
}

export type { TestReviewStore };
export { createTestReviewStore };
