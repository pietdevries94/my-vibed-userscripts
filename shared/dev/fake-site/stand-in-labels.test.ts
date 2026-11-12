import { standInLabels, withStandInLabels } from "./stand-in-labels.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("each token gets one invented name, in order", () => {
  const labels = standInLabels(["text-30", "text-8", "text-30"]);
  assert.deepEqual(
    [...labels],
    [
      ["text-30", "Holt, Mira"],
      ["text-8", "Tomas van Elst"],
    ],
  );
});

test("names run on as numbered people after the list", () => {
  const labels = standInLabels(Array.from({ length: 14 }, (_unused, index) => `text-${index}`));
  assert.equal(labels.get("text-13"), "Person 14");
});

test("tokens are swapped as whole tokens only", () => {
  const labels = standInLabels(["text-3"]);
  assert.equal(
    withStandInLabels('<i aria-label="text-3 ">text-30 text-3</i>', labels),
    '<i aria-label="Holt, Mira ">text-30 Holt, Mira</i>',
  );
});
