import {
  BUILD_OUTPUT,
  DARK,
  DARK_LOOK,
  DARK_ROOT,
  HIGH_CONTRAST,
  LIGHT,
  LIGHT_LOOK,
  LIGHT_ROOT,
  follow,
  pageIn,
  rootStyleOf,
} from "./system-theme.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("remembers how the page looks in the theme it shows", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.prefersDark.matches = true;
  await follow(page).start();

  assert.deepEqual(page.stored, { [DARK]: DARK_LOOK });
  assert.deepEqual(page.saved, []);
});

test("a page in the system's theme stays as it is", async () => {
  const page = pageIn(LIGHT, LIGHT_LOOK);
  await follow(page).start();

  assert.deepEqual(page.saved, []);
  assert.equal(page.reloads, 0);
  assert.equal(rootStyleOf(page.document), LIGHT_ROOT);
});

test("a dark page on a light system switches to Light in place when the light look is known", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.stored = { [LIGHT]: LIGHT_LOOK };
  await follow(page).start();

  assert.deepEqual(page.saved, [LIGHT]);
  assert.equal(page.reloads, 0);
  assert.equal(rootStyleOf(page.document), LIGHT_ROOT);
  assert.equal(page.document.body.dataset.theme, LIGHT);
  assert.deepEqual([...page.document.body.classList], ["lwp", "ms-vss-web-vsts-theme"]);
  assert.equal(page.document.head.querySelectorAll("style")[1]?.textContent, BUILD_OUTPUT);
});

test("without a known look, the page saves the theme and reloads once it has loaded", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  await follow(page).start();

  assert.deepEqual(page.saved, [LIGHT]);
  assert.equal(page.reloads, 1);
});

test("a change of the system's theme switches the open page in place", async () => {
  const page = pageIn(LIGHT, LIGHT_LOOK);
  page.stored = { [DARK]: DARK_LOOK };
  const systemTheme = follow(page);
  await systemTheme.start();

  page.prefersDark.change(true);
  await systemTheme.settled();

  assert.deepEqual(page.saved, [DARK]);
  assert.equal(rootStyleOf(page.document), DARK_ROOT);
  assert.equal(page.document.body.dataset.theme, DARK);
  assert.deepEqual([...page.document.body.classList], ["lwp", ...DARK_LOOK.bodyClasses]);
});

test("a change of the system's theme without a known look saves it, and never reloads an open page", async () => {
  const page = pageIn(LIGHT, LIGHT_LOOK);
  const systemTheme = follow(page);
  await systemTheme.start();

  page.prefersDark.change(true);
  await systemTheme.settled();

  assert.deepEqual(page.saved, [DARK]);
  assert.equal(page.reloads, 0);
  assert.equal(rootStyleOf(page.document), LIGHT_ROOT);
});

test("a refused save leaves the page and does not reload", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.saveFails = true;
  await follow(page).start();

  assert.equal(page.reloads, 0);
  assert.equal(page.document.body.dataset.theme, DARK);
});

test("a high contrast theme is the user's choice and stays", async () => {
  const page = pageIn(HIGH_CONTRAST, {
    bodyClasses: ["ms-vss-web-vsts-theme-hc-dark"],
    rootStyle: DARK_ROOT,
  });
  page.stored = { [LIGHT]: LIGHT_LOOK };
  await follow(page).start();

  assert.deepEqual(page.saved, []);
  assert.deepEqual(page.stored, { [LIGHT]: LIGHT_LOOK });
});

test("switched off, the page keeps its theme", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.stored = { [LIGHT]: LIGHT_LOOK };
  await follow(page, false).start();

  assert.deepEqual(page.saved, []);
  assert.equal(page.document.body.dataset.theme, DARK);
});

test("a theme picked in Azure DevOps's own panel is remembered on the next check", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.prefersDark.matches = true;
  const systemTheme = follow(page);
  await systemTheme.start();

  const [rootStyle] = page.document.head.querySelectorAll("style");
  if (rootStyle !== undefined) {
    rootStyle.textContent = LIGHT_ROOT;
  }
  page.document.body.className = "lwp ms-vss-web-vsts-theme";
  page.document.body.dataset.theme = LIGHT;
  systemTheme.onPageChange();

  assert.deepEqual(page.stored, { [DARK]: DARK_LOOK, [LIGHT]: LIGHT_LOOK });
});
