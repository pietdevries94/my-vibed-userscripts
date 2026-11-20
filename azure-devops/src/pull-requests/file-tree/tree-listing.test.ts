import { findDrawn, listedRows } from "./tree-listing.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const CHANGED_PATHS = [
  "/src/app.ts",
  "/src/forms/index.ts",
  "/src/forms/order.ts",
  "/src/totals/index.ts",
  "/tests/unit/api/v1/index.ts",
  "/tests/unit/setup.ts",
];

test("the listing has folders before files, and one row for folders that are alone", () => {
  assert.deepEqual(
    listedRows(CHANGED_PATHS).map(({ level, name }) => `${level} ${name}`),
    [
      "1 src",
      "2 forms",
      "3 index.ts",
      "3 order.ts",
      "2 totals",
      "3 index.ts",
      "2 app.ts",
      "1 tests/unit",
      "2 api/v1",
      "3 index.ts",
      "2 setup.ts",
    ],
  );
});

/** Drawn rows as "level name". A "…" stands for rows the tree skips there. */
function drawn(...rows: string[]): { isAfterGap: boolean; level: number; name: string }[] {
  return rows.flatMap((row, index) => {
    const [level = "", name = ""] = row.split(" ");
    return row === "…" ? [] : [{ isAfterGap: rows[index - 1] === "…", level: Number(level), name }];
  });
}

/** The paths the listing gives the drawn rows, or null when it gives none. */
function pathsOf(rows: string[], folded: string[] = []): string[] | null {
  const found = findDrawn(CHANGED_PATHS, drawn(...rows), new Set(folded));
  return found === null ? null : found.placeOfDrawn.map((place) => found.paths[place] ?? "");
}

test("drawn rows without their folders are found by the rows around them", () => {
  assert.deepEqual(pathsOf(["3 index.ts", "2 app.ts"]), ["/src/totals/index.ts", "/src/app.ts"]);
});

test("rows that fit in two places are not found", () => {
  assert.equal(pathsOf(["3 index.ts"]), null);
  assert.equal(pathsOf(["3 other.ts"]), null);
  assert.equal(pathsOf([]), null);
});

test("the rows under a folded folder are not in the listing", () => {
  assert.equal(pathsOf(["2 forms", "2 totals"]), null);
  assert.deepEqual(pathsOf(["2 forms", "2 totals"], ["/src/forms"]), ["/src/forms", "/src/totals"]);
});

test("a tree whose first row is not in the listing still fits, one level deeper", () => {
  assert.deepEqual(pathsOf(["3 api/v1", "4 index.ts"]), [
    "/tests/unit/api/v1",
    "/tests/unit/api/v1/index.ts",
  ]);
});

test("rows the tree skips in the middle leave the rows on both sides findable", () => {
  assert.deepEqual(pathsOf(["3 order.ts", "…", "3 index.ts", "2 setup.ts"]), [
    "/src/forms/order.ts",
    "/tests/unit/api/v1/index.ts",
    "/tests/unit/setup.ts",
  ]);
  // A row that fits in several places is the one after the rows before it.
  assert.deepEqual(pathsOf(["2 totals", "…", "3 index.ts"]), null);
  assert.deepEqual(pathsOf(["2 app.ts", "…", "3 index.ts"]), [
    "/src/app.ts",
    "/tests/unit/api/v1/index.ts",
  ]);
});
