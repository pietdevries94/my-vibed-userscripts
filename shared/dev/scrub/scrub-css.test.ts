import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { matchedCss } from "./scrub-css.ts";
import { test } from "node:test";

function cssOf(style: string, body: string): string {
  const { document } = new JSDOM(
    `<!doctype html><html><head><style>${style}</style></head><body>${body}</body></html>`,
  ).window;
  return matchedCss(document.body);
}

test("keeps rules that match an element in the page, and drops the rest", () => {
  const css = cssOf(
    ".reviewer { color: red; } .absent { color: blue; }",
    '<div class="reviewer"></div>',
  );
  assert.match(css, /\.reviewer/u);
  assert.doesNotMatch(css, /\.absent/u);
});

test("keeps state and pseudo-element rules of matching elements", () => {
  const css = cssOf(
    ".button:hover { color: red; } .button::before { content: ''; } .gone:hover { color: blue; }",
    '<button class="button"></button>',
  );
  assert.match(css, /\.button:hover/u);
  assert.match(css, /\.button::before/u);
  assert.doesNotMatch(css, /\.gone/u);
});

test("keeps theme variables on the root", () => {
  assert.match(cssOf(":root { --accent: #0078d4; }", ""), /--accent/u);
});

test("keeps @media wrappers only around matching rules", () => {
  const css = cssOf(
    "@media (max-width: 600px) { .reviewer { color: red; } } @media print { .absent { color: blue; } }",
    '<div class="reviewer"></div>',
  );
  assert.match(css, /@media \(max-width: 600px\)/u);
  assert.doesNotMatch(css, /print/u);
});

test("drops links: url() values, @font-face and @import", () => {
  const css = cssOf(
    "@import url('https://quillfield.example/a.css'); @font-face { font-family: X; src: url(https://quillfield.example/x.woff); } .reviewer { background: url('/quillfield/avatar.png') no-repeat; }",
    '<div class="reviewer"></div>',
  );
  assert.doesNotMatch(css, /quillfield/u);
  assert.doesNotMatch(css, /@font-face|@import/u);
  assert.match(css, /background: none no-repeat/u);
});
