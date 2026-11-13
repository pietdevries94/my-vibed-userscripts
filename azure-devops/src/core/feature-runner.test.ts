import type { Feature, FeatureContext, Tick } from "./feature.ts";
import type { Page } from "./page.ts";
import assert from "node:assert/strict";
import { createFeatureRunner } from "./feature-runner.ts";
import { test } from "node:test";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the test features never read the context
const context = {} as FeatureContext;
const board: Page = { kind: "board" };

interface Recorder {
  events: string[];
  feature: (id: string, behaviour?: { throwsOn?: "start" | "sync"; skips?: boolean }) => Feature;
}

function recorder(): Recorder {
  const events: string[] = [];
  return {
    events,
    feature: (id, { throwsOn, skips = false } = {}) => ({
      description: "",
      id,
      name: id,
      start: () => {
        events.push(`start ${id}`);
        if (throwsOn === "start") {
          throw new Error(id);
        }
        if (skips) {
          return null;
        }
        return {
          sync: (tick: Tick) => {
            if (throwsOn === "sync") {
              throw new Error(id);
            }
            events.push(`sync ${id} ${tick.page.kind} ${tick.reason} ${String(tick.isTabActive)}`);
          },
        };
      },
    }),
  };
}

test("starts and syncs only the features that are on, in list order", () => {
  const { events, feature } = recorder();
  const runner = createFeatureRunner({
    context,
    currentPage: () => board,
    features: [feature("a"), feature("b"), feature("c")],
    isOn: ({ id }) => id !== "b",
    isTabActive: () => true,
    onError: () => {
      throw new Error("no feature fails");
    },
  });
  runner.sync("timer");
  assert.deepEqual(events, [
    "start a",
    "start c",
    "sync a board timer true",
    "sync c board timer true",
  ]);
});

test("a feature that starts with nothing to sync is skipped", () => {
  const { events, feature } = recorder();
  const runner = createFeatureRunner({
    context,
    currentPage: () => board,
    features: [feature("a", { skips: true })],
    isOn: () => true,
    isTabActive: () => false,
    onError: () => {
      throw new Error("no feature fails");
    },
  });
  runner.sync("dom-change");
  assert.deepEqual(events, ["start a"]);
});

test("a feature that throws leaves the others running", () => {
  const { events, feature } = recorder();
  const failed: string[] = [];
  const runner = createFeatureRunner({
    context,
    currentPage: () => board,
    features: [
      feature("a", { throwsOn: "start" }),
      feature("b", { throwsOn: "sync" }),
      feature("c"),
    ],
    isOn: () => true,
    isTabActive: () => false,
    onError: ({ id }) => {
      failed.push(id);
    },
  });
  runner.sync("tab-shown");
  assert.deepEqual(failed, ["a", "b"]);
  assert.deepEqual(events.at(-1), "sync c board tab-shown false");
});
