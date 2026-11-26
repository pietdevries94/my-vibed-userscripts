// The features in script.json, which the README and the @description header show,
// sit under the settings panel's section names, in its order.
import { SECTION_NAMES } from "./section-names.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

interface FeatureGroup {
  category: string;
}

test("script.json lists its features under the settings panel's sections, in its order", () => {
  const file = path.join(import.meta.dirname, "..", "..", "script.json");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the build checks this shape
  const { features } = JSON.parse(fs.readFileSync(file, "utf8")) as { features: FeatureGroup[] };
  assert.deepEqual(
    features.map(({ category }) => category),
    SECTION_NAMES,
  );
});
