import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "./fixture-dom.ts";
import { test } from "node:test";

test("a link row inside a table body stays in the table", () => {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const html =
    '<table><colgroup><col style="width: 1px"></colgroup><tbody><a class="row" href="/x"><td>cell</td></a></tbody></table>';
  const table = buildFixtureDom(document, html);
  assert.equal(table?.localName, "table");
  assert.equal(table?.querySelector("tbody > a.row > td")?.textContent, "cell");
  assert.equal(table?.querySelector("colgroup > col")?.getAttribute("style"), "width: 1px");
});
