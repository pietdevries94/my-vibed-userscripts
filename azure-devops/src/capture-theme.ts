// The theme settings capture: the theme panel, the page's theme data and the user's
// settings entries. Dev file only.
import { AdoRequestError, getJson } from "./ado-request.ts";
import type { CapturePage } from "../../shared/dev/capture/capture.ts";
import { apiBasePath } from "./pull-request-link.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

const SETTINGS_API_VERSION = "7.1-preview.1";
const THEME_REQUEST = /setting|theme|contribution/iu;

/** The theme panel opens over any page, from the user menu. */
function isThemePanelOpen(document: Document): boolean {
  return document.querySelector(".theme-panel") !== null;
}

/** Path segments that identify nothing: routes, Microsoft's theme ids and file names. */
const KEPT_SEGMENT = /^(?:_\w+|apis|Settings|Entries|me|ms\.vss-[\w.-]+|[\w.-]*theme[\w.-]*)$/iu;
const KEPT_QUERY_VALUE = /^(?:ms\.vss-[\w.-]+|[\d.-]+(?:preview[\d.]*)?)$/iu;

/** A URL's shape: other segments become "x", query values too, and the host says only whether it is the page's own. */
function urlShape(url: string): string {
  const parsed = new URL(url, location.href);
  const host = parsed.origin === location.origin ? "page-origin" : "other-origin";
  const path = parsed.pathname
    .split("/")
    .map((segment) => (segment === "" || KEPT_SEGMENT.test(segment) ? segment : "x"))
    .join("/");
  const query = [...parsed.searchParams]
    .map(([name, value]) => `${name}=${KEPT_QUERY_VALUE.test(value) ? value : "x"}`)
    .join("&");
  return `${host}${path}${query === "" ? "" : `?${query}`}`;
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
    styleElementIds: [...document.querySelectorAll("style[id]")]
      .map((style) => style.id)
      .filter((id) => KEPT_SEGMENT.test(id)),
    themeStylesheets: [...document.querySelectorAll("link[rel=stylesheet]")]
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => /theme/iu.test(href))
      .map((href) => urlShape(href)),
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
        },
        meta: themeMarks(document),
      };
    },
    name: "theme",
    root: withoutScriptMarks(document.body),
    styleRoot: document.body,
  };
}

export { isThemePanelOpen, themeSettingsPage };
