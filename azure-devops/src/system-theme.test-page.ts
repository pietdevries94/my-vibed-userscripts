// A page as Azure DevOps renders it, with the system theme following it, for the
// system theme tests. Test code only.
import { JSDOM } from "jsdom";
import type { ThemeLooks } from "./system-theme.ts";
import { createSystemTheme } from "./system-theme.ts";

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

function follow(page: FakePage): ReturnType<typeof createSystemTheme> {
  return createSystemTheme({
    document: page.document,
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

export {
  DARK,
  DARK_LOOK,
  DARK_ROOT,
  HIGH_CONTRAST,
  LIGHT,
  LIGHT_LOOK,
  LIGHT_ROOT,
  BUILD_OUTPUT,
  follow,
  freshPageIn,
  pageIn,
  pageWithBody,
  rootStyleOf,
};
export type { FakePage };
