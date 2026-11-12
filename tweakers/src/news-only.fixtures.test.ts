import { HIDDEN_PARTS, NEWS_ITEM_LIST } from "./news-only.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

/** The captured homepage. Its root is `<body>`, so it parses as a whole document. */
function capturedHomepage(): Document {
  return new JSDOM(`<!doctype html><html>${fixtures.read("homepage.html")}</html>`).window.document;
}

test("every hidden part is on the captured homepage", { skip: fixtures.skip }, () => {
  const document = capturedHomepage();
  for (const selector of HIDDEN_PARTS) {
    assert.ok(document.querySelector(selector) !== null, `${selector} is on the homepage`);
  }
});

test("the news item list stays visible and holds news items", { skip: fixtures.skip }, () => {
  const document = capturedHomepage();
  const list = document.querySelector(NEWS_ITEM_LIST);
  assert.ok(list !== null, "the news item list is on the homepage");
  assert.ok(list.querySelectorAll("article.headline").length > 0, "the news item list has items");
  for (const selector of HIDDEN_PARTS) {
    assert.equal(list.closest(selector), null, `${selector} does not contain the news item list`);
    assert.equal(
      list.querySelector(selector),
      null,
      `${selector} is not inside the news item list`,
    );
  }
});
