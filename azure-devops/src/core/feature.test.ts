import type { Feature } from "./feature.ts";
import assert from "node:assert/strict";
import { isFeatureOn } from "./feature.ts";
import { test } from "node:test";

const feature = (extra: Partial<Feature> = {}): Feature => ({
  description: "What it does.",
  id: "dots",
  name: "Dots",
  start: () => null,
  styles: [],
  ...extra,
});

const nothingSaved = (_id: string, fallback: boolean): boolean => fallback;

test("a feature the owner never chose is on", () => {
  assert.equal(isFeatureOn(feature(), nothingSaved), true);
});

test("a feature that is off by default stays off until the owner turns it on", () => {
  assert.equal(isFeatureOn(feature({ isOffByDefault: true }), nothingSaved), false);
});

test("the owner's saved choice wins over the default", () => {
  const saved = new Map([["dots", true]]);
  const savedChoice = (id: string, fallback: boolean): boolean => saved.get(id) ?? fallback;
  assert.equal(isFeatureOn(feature({ isOffByDefault: true }), savedChoice), true);
  saved.set("dots", false);
  assert.equal(isFeatureOn(feature(), savedChoice), false);
});
