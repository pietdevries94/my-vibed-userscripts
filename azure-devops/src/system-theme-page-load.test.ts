// The system theme on a page Azure DevOps is still rendering: the theme only in a body
// class, or not marked yet when the script starts.
import {
  DARK,
  DARK_ROOT,
  LIGHT,
  LIGHT_LOOK,
  LIGHT_ROOT,
  follow,
  freshPageIn,
  pageWithBody,
  rootStyleOf,
} from "./system-theme.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("a freshly loaded dark page, marked only by its body class, switches to Light", async () => {
  const page = freshPageIn("ms-vss-web-vsts-theme-dark", DARK_ROOT);
  page.stored = { [LIGHT]: LIGHT_LOOK };
  await follow(page).start();

  assert.deepEqual(page.saved, [LIGHT]);
  assert.equal(rootStyleOf(page.document), LIGHT_ROOT);
  assert.deepEqual([...page.document.body.classList], ["lwp", "ms-vss-web-vsts-theme"]);
  assert.equal(page.document.body.dataset.theme, LIGHT);
});

test("a freshly loaded page is remembered by the theme of its body class", async () => {
  const page = freshPageIn("ms-vss-web-vsts-theme-dark", DARK_ROOT);
  page.prefersDark.matches = true;
  await follow(page).start();

  assert.deepEqual(page.stored, {
    [DARK]: { bodyClasses: ["ms-vss-web-vsts-theme-dark"], rootStyle: DARK_ROOT },
  });
  assert.deepEqual(page.saved, []);
});

test("a freshly loaded light page on a dark system saves Dark and reloads", async () => {
  const page = freshPageIn("ms-vss-web-vsts-theme", LIGHT_ROOT);
  page.prefersDark.matches = true;
  await follow(page).start();

  assert.deepEqual(page.saved, [DARK]);
  assert.equal(page.reloads, 1);
});

test("a freshly loaded high contrast page stays", async () => {
  const page = freshPageIn("ms-vss-web-vsts-theme-hc-dark", DARK_ROOT);
  page.stored = { [LIGHT]: LIGHT_LOOK };
  await follow(page).start();

  assert.deepEqual(page.saved, []);
});

test("a page that shows its theme only after the script starts is remembered then", async () => {
  const page = pageWithBody(DARK_ROOT, 'class="lwp"');
  page.prefersDark.matches = true;
  const systemTheme = follow(page);
  await systemTheme.start();
  assert.deepEqual(page.stored, {});

  page.document.body.classList.add("ms-vss-web-vsts-theme-dark");
  systemTheme.onPageChange();
  await systemTheme.settled();

  assert.deepEqual(page.stored, {
    [DARK]: { bodyClasses: ["ms-vss-web-vsts-theme-dark"], rootStyle: DARK_ROOT },
  });
  assert.deepEqual(page.saved, []);
});

test("a page that shows its theme late still gets the page-load switch, once", async () => {
  const page = pageWithBody(DARK_ROOT, 'class="lwp"');
  const systemTheme = follow(page);
  await systemTheme.start();
  assert.deepEqual(page.saved, []);

  page.document.body.classList.add("ms-vss-web-vsts-theme-dark");
  systemTheme.onPageChange();
  systemTheme.onPageChange();
  await systemTheme.settled();

  assert.deepEqual(page.saved, [LIGHT]);
  assert.equal(page.reloads, 1);
});
