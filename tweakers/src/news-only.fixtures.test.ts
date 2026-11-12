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

test(
  "the menu bar, the search bar and the rest of the page stay visible",
  { skip: fixtures.skip },
  () => {
    const document = capturedHomepage();
    const keptParts = ["#menubar", "#searchbar", ".community-block", "twk-sidebar", "#bottom"];
    for (const kept of keptParts) {
      const element = document.querySelector(kept);
      assert.ok(element !== null, `${kept} is on the homepage`);
      for (const selector of HIDDEN_PARTS) {
        assert.equal(element.closest(selector), null, `${selector} does not hide ${kept}`);
      }
    }
  },
);

test("the top banner and the category bar are hidden", { skip: fixtures.skip }, () => {
  const document = capturedHomepage();
  for (const part of [".top-banner", "#categoryBar"]) {
    const element = document.querySelector(part);
    assert.ok(element !== null, `${part} is on the homepage`);
    assert.ok(
      HIDDEN_PARTS.some((selector) => element.matches(selector)),
      `${part} is hidden`,
    );
  }
});
