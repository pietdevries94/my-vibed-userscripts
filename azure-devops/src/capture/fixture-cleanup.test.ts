import assert from "node:assert/strict";
import { cleanFixtureHtml } from "./fixture-cleanup.ts";
import { test } from "node:test";

test("a captured body loses the script's elements and marks, and keeps the page", () => {
  const html = `<body class="lwp fix-ado-starred-picking"><div class="bolt-card" data-fix-ado-thread="open"><p>Ship it</p><button class="fix-ado-thread-toggle bolt-button">+</button></div></body>`;
  assert.equal(
    cleanFixtureHtml(html),
    `<body class="lwp"><div class="bolt-card"><p>Ship it</p></div></body>`,
  );
});

test("a capture of one element stays that element", () => {
  assert.equal(
    cleanFixtureHtml(`<div class="bolt-panel"><span class="fix-ado-star"></span>Reviewers</div>`),
    `<div class="bolt-panel">Reviewers</div>`,
  );
});

test("a row that is a link stays inside its table, with its cells", () => {
  const html = `<div class="bolt-card"><table class="bolt-table"><tbody><a class="bolt-table-row" href="/pr/7"><td class="bolt-table-cell">Fix the login</td></a></tbody></table></div>`;
  assert.equal(cleanFixtureHtml(html), html);
});
