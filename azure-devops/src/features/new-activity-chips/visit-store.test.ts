import assert from "node:assert/strict";
import { createVisitStore } from "./visit-store.ts";
import { test } from "node:test";

function memoryStorage(initial: Record<string, unknown> = {}): {
  values: Map<string, unknown>;
  storage: Parameters<typeof createVisitStore>[0];
} {
  const values = new Map(Object.entries(initial));
  return {
    storage: {
      keys: () => [...values.keys()],
      load: (key) => values.get(key) ?? null,
      remove: (key) => {
        values.delete(key);
      },
      save: (key, visitedAt) => {
        values.set(key, visitedAt);
      },
    },
    values,
  };
}

test("a pull request without a saved visit has none", () => {
  const store = createVisitStore(memoryStorage().storage);
  assert.equal(store.lastVisit("example.test/p/r/7"), null);
});

test("a saved visit comes back under the same pull request only", () => {
  const store = createVisitStore(memoryStorage().storage);
  store.save("example.test/p/r/7", 1000);
  assert.equal(store.lastVisit("example.test/p/r/7"), 1000);
  assert.equal(store.lastVisit("example.test/p/r/8"), null);
});

test("a stored value that is no time counts as no visit", () => {
  const store = createVisitStore(
    memoryStorage({ "last-visit:example.test/p/r/7": "soon" }).storage,
  );
  assert.equal(store.lastVisit("example.test/p/r/7"), null);
});

test("cleanup deletes visits older than the age, and leaves other keys alone", () => {
  const { storage, values } = memoryStorage({
    "last-visit:example.test/p/r/1": 100,
    "last-visit:example.test/p/r/2": 900,
    "last-visit:example.test/p/r/3": "soon",
    "review:example.test/p/r/1": { updatedAt: 100 },
  });
  createVisitStore(storage).deleteOlderThan(500, 1000);
  assert.deepEqual(
    [...values.keys()],
    ["last-visit:example.test/p/r/2", "review:example.test/p/r/1"],
  );
});
