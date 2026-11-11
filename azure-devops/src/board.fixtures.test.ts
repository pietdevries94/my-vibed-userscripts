import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { findBoardCardIds } from "./board.ts";

const fixtures = scriptFixtures(import.meta.dirname);

test("the captured board has cards", { skip: fixtures.skip }, () => {
  const { document } = new JSDOM(fixtures.read("page-board.html")).window;
  assert.equal(document.querySelectorAll(".wit-card[data-itemid]").length, 99);
  assert.deepEqual(findBoardCardIds(document), [], "the capture masked every id to zeros");
});
