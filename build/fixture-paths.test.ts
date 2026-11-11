import assert from "node:assert/strict";
import { isFixturePath } from "./fixture-paths.ts";
import { test } from "node:test";

test("any path with a fixtures segment is a fixture path", () => {
  assert.equal(isFixturePath("azure-devops/fixtures/page.html"), true);
  assert.equal(isFixturePath("azure-devops/fixtures"), true, "a symlink named fixtures");
  assert.equal(isFixturePath("fixtures/x.json"), true);
});

test("a name that only contains the word is not a fixture path", () => {
  assert.equal(isFixturePath("build/fixture-paths.ts"), false);
  assert.equal(isFixturePath("azure-devops/src/pr-list.fixtures.test.ts"), false);
});
