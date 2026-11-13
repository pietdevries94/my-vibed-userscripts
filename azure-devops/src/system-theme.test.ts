import { JSDOM } from "jsdom";
import type { ThemeLooks } from "./system-theme.ts";
import assert from "node:assert/strict";
import { createSystemTheme } from "./system-theme.ts";
import { test } from "node:test";

const LIGHT = "ms.vss-web.vsts-theme";
const DARK = "ms.vss-web.vsts-theme-dark";
const HIGH_CONTRAST = "ms.vss-web.vsts-theme-hc-dark";
const LIGHT_ROOT =
  ":root { --palette-neutral-0: 255, 255, 255; --background-color: rgba(var(--palette-neutral-0), 1); }";
const DARK_ROOT =
  ":root { --palette-neutral-0: 32, 31, 30; --background-color: rgba(var(--palette-neutral-0), 1); }";
const BUILD_OUTPUT = ".dark-build-output { --palette-neutral-0: 32, 31, 30; }";
const LIGHT_LOOK = { bodyClasses: ["ms-vss-web-vsts-theme"], rootStyle: LIGHT_ROOT };
const DARK_LOOK = {
  bodyClasses: ["ms-vss-web-vsts-theme", "ms-vss-web-vsts-theme-dark"],
  rootStyle: DARK_ROOT,
};

interface FakePage {
  document: Document;
  prefersDark: { matches: boolean; change: (matches: boolean) => void };
  systemThemeListeners: (() => void)[];
  saved: string[];
  stored: ThemeLooks;
  reloads: number;
  saveFails: boolean;
}

/** A page as Azure DevOps renders it after a switch in its theme panel: with `data-theme`. */
function pageIn(themeId: string, look: { bodyClasses: string[]; rootStyle: string }): FakePage {
  return pageWithBody(
    look.rootStyle,
    `class="lwp ${look.bodyClasses.join(" ")}" data-theme="${themeId}"`,
  );
}

/** A page as Azure DevOps first renders it: the theme only in one body class. */
function freshPageIn(themeClass: string, rootStyle: string): FakePage {
  return pageWithBody(rootStyle, `class="lwp ${themeClass}"`);
}

function pageWithBody(rootStyle: string, bodyAttributes: string): FakePage {
  const { document } = new JSDOM(
    `<!doctype html><head><style type="text/css">${rootStyle}</style><style type="text/css">${BUILD_OUTPUT}</style></head>
    <body ${bodyAttributes}></body>`,
  ).window;
  const page: FakePage = {
    document,
    prefersDark: {
      change(matches) {
        page.prefersDark.matches = matches;
        for (const listener of page.systemThemeListeners) {
          listener();
        }
      },
      matches: false,
    },
    reloads: 0,
    saveFails: false,
    saved: [],
    stored: {},
    systemThemeListeners: [],
  };
  return page;
}

function follow(page: FakePage, isOn = true): ReturnType<typeof createSystemTheme> {
  return createSystemTheme({
    document: page.document,
    isOn: () => isOn,
    looks: {
      load: () => page.stored,
      save: (looks) => {
        page.stored = looks;
      },
    },
    onSystemThemeChange: (listener) => {
      page.systemThemeListeners.push(listener);
    },
    prefersDark: () => page.prefersDark.matches,
    reload: () => {
      page.reloads += 1;
    },
    saveTheme: async (themeId) => {
      if (page.saveFails) {
        throw new Error("refused");
      }
      page.saved.push(themeId);
    },
  });
}

function rootStyleOf(document: Document): string {
  return document.head.querySelector("style")?.textContent ?? "";
}

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

test("a change the event never reports is found by the next check", async () => {
  const page = pageIn(LIGHT, LIGHT_LOOK);
  page.stored = { [DARK]: DARK_LOOK };
  const systemTheme = follow(page);
  await systemTheme.start();

  page.prefersDark.matches = true;
  systemTheme.checkSystemTheme();
  await systemTheme.settled();

  assert.deepEqual(page.saved, [DARK]);
  assert.equal(rootStyleOf(page.document), DARK_ROOT);
});

test("the event and the next check switch once for one change", async () => {
  const page = pageIn(LIGHT, LIGHT_LOOK);
  page.stored = { [DARK]: DARK_LOOK };
  const systemTheme = follow(page);
  await systemTheme.start();

  page.prefersDark.change(true);
  systemTheme.checkSystemTheme();
  await systemTheme.settled();

  assert.deepEqual(page.saved, [DARK]);
});

test("a check without a change of the system's theme sends nothing", async () => {
  const page = pageIn(DARK, DARK_LOOK);
  page.saveFails = true;
  const systemTheme = follow(page);
  await systemTheme.start();
  page.saveFails = false;

  systemTheme.checkSystemTheme();
  await systemTheme.settled();

  assert.deepEqual(page.saved, []);
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
  systemTheme.remember();

  assert.deepEqual(page.stored, { [DARK]: DARK_LOOK, [LIGHT]: LIGHT_LOOK });
});

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
