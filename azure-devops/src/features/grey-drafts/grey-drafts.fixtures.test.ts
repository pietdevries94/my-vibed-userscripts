// The grey background lands on exactly the rows that show the site's Draft pill.
import { findPullRequestRows, isDraftRow } from "../../pull-requests/pr-list.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import fs from "node:fs";
import path from "node:path";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);
const style = fs.readFileSync(path.join(import.meta.dirname, "style.css"), "utf8");
/** The selector of the stylesheet's first rule: the draft row in light and dark. */
const draftRowSelector =
  style
    .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
    .split("{")[0]
    ?.trim() ?? "";

for (const page of ["pr-list", "pr-inbox", "pr-list-win98", "pr-inbox-assigned-active-inbox"]) {
  test(
    `${page}: the grey background matches the draft rows only`,
    { skip: fixtures.skipWithout(`${page}.html`) },
    () => {
      const { document } = new JSDOM("<!doctype html><body></body>").window;
      const root = buildFixtureDom(document, fixtures.read(`${page}.html`));
      assert.ok(root !== null);
      document.body.append(root);
      const rows = findPullRequestRows(document, "/fake-org").map(({ row }) => row);
      const greyRows = rows.filter((row) => row.matches(draftRowSelector));

      assert.ok(greyRows.length > 0);
      assert.ok(greyRows.length < rows.length);
      assert.deepEqual(
        greyRows,
        rows.filter((row) => isDraftRow(row)),
      );
    },
  );
}
