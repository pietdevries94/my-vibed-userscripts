import { HIDDEN_PARTS, NEWS_ONLY_CLASS, newsOnlyStyle, showNewsOnly } from "./news-only.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

function documentAt(url: string): { document: Document; location: Location } {
  const { window } = new JSDOM("<!doctype html><body></body>", { url });
  return { document: window.document, location: window.location };
}

function isStyleRule(rule: CSSRule | undefined): rule is CSSStyleRule {
  return rule !== undefined && "selectorText" in rule;
}

test("the homepage gets the news-only class", () => {
  const { document, location } = documentAt("https://example.test/");
  showNewsOnly(document, location);
  assert.ok(document.documentElement.classList.contains(NEWS_ONLY_CLASS));
});

test("other pages keep their layout", () => {
  const { document, location } = documentAt("https://example.test/nieuws/1234/een-bericht.html");
  showNewsOnly(document, location);
  assert.ok(!document.documentElement.classList.contains(NEWS_ONLY_CLASS));
});

test("the homepage with a query still counts as the homepage", () => {
  const { document, location } = documentAt("https://example.test/?ref=menu");
  showNewsOnly(document, location);
  assert.ok(document.documentElement.classList.contains(NEWS_ONLY_CLASS));
});

test("every hidden part is hidden only under the news-only class", () => {
  const { document } = documentAt("https://example.test/");
  const style = document.createElement("style");
  style.textContent = newsOnlyStyle();
  document.head.append(style);
  const [hideRule] = style.sheet?.cssRules ?? [];
  assert.ok(isStyleRule(hideRule), "the first rule is a style rule");
  assert.ok(hideRule.selectorText.startsWith(`html.${NEWS_ONLY_CLASS} `));
  for (const selector of HIDDEN_PARTS) {
    assert.ok(hideRule.selectorText.includes(selector), `${selector} is in the hide rule`);
  }
  assert.equal(hideRule.style.getPropertyValue("display"), "none");
});
