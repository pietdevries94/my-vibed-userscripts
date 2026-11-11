import { bumpVersion, compareVersions, versionOf } from "./versions.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("reads @version from a metadata block", () => {
  assert.equal(versionOf("// ==UserScript==\n// @version      1.2.3\n// ==/UserScript=="), "1.2.3");
  assert.equal(versionOf("// ==UserScript==\n// ==/UserScript=="), null);
});

test("compares versions by number, not by text", () => {
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("1.0.0", "1.0.1") < 0);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
});

test("bumps patch, minor and major", () => {
  assert.equal(bumpVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(bumpVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(bumpVersion("1.2.3", "major"), "2.0.0");
});
