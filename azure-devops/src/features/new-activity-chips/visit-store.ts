// When the owner last left each pull request's Overview, kept in the script's storage. One
// storage key per pull request, so two tabs on different pull requests never write the same value.

interface VisitStorage {
  load: (key: string) => unknown;
  save: (key: string, visitedAt: number) => void;
  remove: (key: string) => void;
  keys: () => string[];
}

interface VisitStore {
  /** When the owner last left this pull request, or null when the script never saw a visit. */
  lastVisit: (pullRequestKey: string) => number | null;
  save: (pullRequestKey: string, visitedAt: number) => void;
  /** Deletes every visit, and every value that is no visit, saved more than `maxAgeMs` before `now`. */
  deleteOlderThan: (maxAgeMs: number, now: number) => void;
}

const KEY_PREFIX = "last-visit:";

const visitedAtOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function createVisitStore(storage: VisitStorage): VisitStore {
  return {
    deleteOlderThan(maxAgeMs, now) {
      for (const key of storage.keys().filter((name) => name.startsWith(KEY_PREFIX))) {
        const visitedAt = visitedAtOf(storage.load(key));
        if (visitedAt === null || now - visitedAt > maxAgeMs) {
          storage.remove(key);
        }
      }
    },
    lastVisit: (pullRequestKey) => visitedAtOf(storage.load(`${KEY_PREFIX}${pullRequestKey}`)),
    save(pullRequestKey, visitedAt) {
      storage.save(`${KEY_PREFIX}${pullRequestKey}`, visitedAt);
    },
  };
}

export type { VisitStore };
export { createVisitStore };
