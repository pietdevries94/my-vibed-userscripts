// Follows the system's light or dark mode: Azure DevOps shows Light or Dark to match.
// Azure DevOps keeps only the current theme's palette in the page. So the script
// remembers how each theme looks once a page has shown it, and switches in place to
// a remembered look. Without one, it saves the theme and reloads a page that just loaded.

import { AdoRequestError } from "./ado-request.ts";
import { log } from "../../shared/runtime/script-log.ts";

const LIGHT_THEME_ID = "ms.vss-web.vsts-theme";
const DARK_THEME_ID = "ms.vss-web.vsts-theme-dark";
/** The start of the body classes Azure DevOps sets per theme, such as `ms-vss-web-vsts-theme-dark`. */
const THEME_CLASS_PREFIX = "ms-vss-web-vsts-theme";
const PALETTE_VARIABLE = "--palette-neutral-0";

/** How a theme looks: the palette style and the body's theme classes. */
interface ThemeLook {
  bodyClasses: string[];
  rootStyle: string;
}

/** Remembered looks, by theme id. */
type ThemeLooks = Record<string, ThemeLook>;

interface SystemThemeOptions {
  document: Document;
  isOn: () => boolean;
  looks: { load: () => ThemeLooks; save: (looks: ThemeLooks) => void };
  onSystemThemeChange: (listener: () => void) => void;
  prefersDark: () => boolean;
  reload: () => void;
  saveTheme: (themeId: string) => Promise<void>;
}

interface SystemTheme {
  /** Remembers the current look and follows the system: in place, or with a reload. */
  start: () => Promise<void>;
  /** Remembers the look of the theme the page shows, such as one picked in the theme panel. */
  remember: () => void;
  /** Switches when the system's theme changed since the last look, even if no event said so. */
  checkSystemTheme: () => void;
  /** Resolves when the last switch has finished. */
  settled: () => Promise<void>;
}

const LIGHT_THEME_CLASS = "ms-vss-web-vsts-theme";
const DARK_THEME_CLASS = "ms-vss-web-vsts-theme-dark";

/**
 * The theme the page shows. A page that just loaded marks it only with a body class;
 * `data-theme` comes when the theme panel switches. A light page after a switch to Dark
 * keeps the light class next to the dark one.
 */
function currentThemeId(document: Document): string | undefined {
  const { body } = document;
  if (body.dataset.theme !== undefined) {
    return body.dataset.theme;
  }
  const themeClasses = [...body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX));
  if (themeClasses.some((name) => name !== LIGHT_THEME_CLASS && name !== DARK_THEME_CLASS)) {
    return undefined;
  }
  if (themeClasses.includes(DARK_THEME_CLASS)) {
    return DARK_THEME_ID;
  }
  return themeClasses.includes(LIGHT_THEME_CLASS) ? LIGHT_THEME_ID : undefined;
}

function isFollowedTheme(themeId: string | undefined): themeId is string {
  return themeId === LIGHT_THEME_ID || themeId === DARK_THEME_ID;
}

/** The style that holds the page's palette, `:root { --palette-… }`. */
function findRootStyle(document: Document): HTMLStyleElement | null {
  return (
    [...document.head.querySelectorAll("style")].find((style) => {
      const text = style.textContent.trimStart();
      return text.startsWith(":root") && text.includes(PALETTE_VARIABLE);
    }) ?? null
  );
}

function readLook(document: Document): ThemeLook | null {
  const rootStyle = findRootStyle(document);
  if (rootStyle === null) {
    return null;
  }
  return {
    bodyClasses: [...document.body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX)),
    rootStyle: rootStyle.textContent,
  };
}

function applyLook(document: Document, themeId: string, look: ThemeLook): boolean {
  const rootStyle = findRootStyle(document);
  if (rootStyle === null) {
    return false;
  }
  rootStyle.textContent = look.rootStyle;
  const { body } = document;
  body.classList.remove(
    ...[...body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX)),
  );
  body.classList.add(...look.bodyClasses);
  body.dataset.theme = themeId;
  return true;
}

function rememberLook({ document, looks }: SystemThemeOptions): void {
  const themeId = currentThemeId(document);
  const look = readLook(document);
  if (!isFollowedTheme(themeId) || look === null) {
    return;
  }
  const stored = looks.load();
  if (JSON.stringify(stored[themeId]) !== JSON.stringify(look)) {
    looks.save({ ...stored, [themeId]: look });
  }
}

/** The theme to switch to, or null when the page shows it already or is not followed. */
function themeToSwitchTo(options: SystemThemeOptions): string | null {
  const current = currentThemeId(options.document);
  const wanted = options.prefersDark() ? DARK_THEME_ID : LIGHT_THEME_ID;
  return options.isOn() && isFollowedTheme(current) && current !== wanted ? wanted : null;
}

async function trySaveTheme(options: SystemThemeOptions, themeId: string): Promise<boolean> {
  try {
    await options.saveTheme(themeId);
    return true;
  } catch (error: unknown) {
    log("System theme: Azure DevOps refused the theme save", {
      httpStatus: error instanceof AdoRequestError ? error.httpStatus : null,
    });
    return false;
  }
}

/** Switches to the system's theme: in place with a remembered look, else by a reload of a page that just loaded. */
async function switchToSystemTheme(
  options: SystemThemeOptions,
  isPageLoad: boolean,
): Promise<void> {
  const wanted = themeToSwitchTo(options);
  log("System theme: checked", {
    current: currentThemeId(options.document) ?? null,
    isOn: options.isOn(),
    isPageLoad,
    prefersDark: options.prefersDark(),
    rememberedThemes: Object.keys(options.looks.load()),
  });
  if (wanted === null || !(await trySaveTheme(options, wanted))) {
    return;
  }
  const look = options.looks.load()[wanted];
  const isSwitched = look !== undefined && applyLook(options.document, wanted, look);
  log("System theme: saved", {
    hasRootStyle: findRootStyle(options.document) !== null,
    isSwitched,
    wanted,
  });
  if (!isSwitched && isPageLoad) {
    options.reload();
  }
}

function createSystemTheme(options: SystemThemeOptions): SystemTheme {
  let lastSwitch = Promise.resolve();
  let seenPrefersDark = options.prefersDark();

  function checkSystemTheme(): void {
    const prefersDark = options.prefersDark();
    if (prefersDark !== seenPrefersDark) {
      seenPrefersDark = prefersDark;
      lastSwitch = lastSwitch.then(async () => switchToSystemTheme(options, false));
    }
  }

  options.onSystemThemeChange(() => {
    log("System theme: the system's theme changed");
    checkSystemTheme();
  });

  return {
    checkSystemTheme,
    remember: () => {
      rememberLook(options);
    },
    settled: async () => lastSwitch,
    async start() {
      seenPrefersDark = options.prefersDark();
      rememberLook(options);
      lastSwitch = switchToSystemTheme(options, true);
      await lastSwitch;
    },
  };
}

export { createSystemTheme };
export type { SystemTheme, ThemeLook, ThemeLooks };
