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
