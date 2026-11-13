// The theme settings capture: the theme panel, the page's theme data and the user's
// settings entries. Dev file only.
import { AdoRequestError, getJson } from "../core/ado-request.ts";
import { startThemeWatch, themeWatchReport, urlShape } from "./capture-theme-watch.ts";
import type { CapturePage } from "../../../shared/dev/capture/capture.ts";
import { apiBasePath } from "../pull-requests/pull-request-link.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

/** Where the page keeps the palette of each theme, in `sharedData`. */
const THEMES_KEY = "_themes";
const SETTINGS_API_VERSION = "7.1-preview.1";
const THEME_REQUEST = /setting|theme|contribution/iu;

/** The theme panel opens over any page, from the user menu. */
function isThemePanelOpen(document: Document): boolean {
  return document.querySelector(".theme-panel") !== null;
}

/** The page's requests about settings and themes, such as the one a theme tile sends. */
function themeRequests(): string[] {
  return performance
    .getEntriesByType("resource")
    .filter((entry) => THEME_REQUEST.test(entry.name))
    .map(
      (entry) =>
        `${entry instanceof PerformanceResourceTiming ? entry.initiatorType : ""} ${urlShape(entry.name)}`,
    );
}

/** The data providers in the page's own JSON, limited to the ones about themes. */
function themeDataProviders(document: Document): Record<string, unknown> {
  const script = document.querySelector("script#dataProviders");
  if (script?.textContent === null || script?.textContent === undefined) {
    return {};
  }
  const parsed: unknown = JSON.parse(script.textContent);
  if (typeof parsed !== "object" || parsed === null || !("data" in parsed)) {
    return {};
  }
  const { data } = parsed;
  if (typeof data !== "object" || data === null) {
    return {};
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => /theme/iu.test(key)));
}

/** The palettes of every theme the page carries, by theme id. */
function pageThemes(document: Document): unknown {
  const script = document.querySelector("script#dataProviders");
  const parsed: unknown = JSON.parse(script?.textContent ?? "{}");
  if (typeof parsed !== "object" || parsed === null || !("sharedData" in parsed)) {
    return null;
  }
  const { sharedData } = parsed;
  return typeof sharedData === "object" && sharedData !== null
    ? (Reflect.get(sharedData, THEMES_KEY) ?? null)
    : null;
}

function marksOf(element: Element): Record<string, unknown> {
  return { attributes: element.getAttributeNames(), classes: [...element.classList] };
}

/** How the page marks its theme: classes and attribute names on html and body. */
function themeMarks(document: Document): Record<string, unknown> {
  return {
    body: marksOf(document.body),
    html: marksOf(document.documentElement),
    prefersDark: globalThis.matchMedia("(prefers-color-scheme: dark)").matches,
    requests: themeRequests(),
    themeStylesheets: [...document.querySelectorAll("link[rel=stylesheet]")]
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => /theme/iu.test(href))
      .map((href) => urlShape(href)),
    themeWatch: themeWatchReport(),
  };
}

function themeSettingsPage(document: Document, location: Location): CapturePage {
  return {
    async collect(fetch) {
      const options = { apiBasePath: apiBasePath(location), fetch, origin: location.origin };
      const settings = await getJson(
        options,
        `/_apis/Settings/Entries/me/WebPlatform/Theme?api-version=${SETTINGS_API_VERSION}`,
      ).then(
        ({ body }) => body,
        (error: unknown) => ({
          httpStatus: error instanceof AdoRequestError ? error.httpStatus : 0,
        }),
      );
      return {
        data: {
          dataProviders: themeDataProviders(document),
          settings,
          themes: pageThemes(document),
        },
        meta: themeMarks(document),
      };
    },
    name: "theme",
    root: withoutScriptMarks(document.body),
    styleRoot: document.body,
  };
}

// The watch must run before the owner opens the panel, so it starts with the dev file.
startThemeWatch();

export { isThemePanelOpen, themeSettingsPage };
