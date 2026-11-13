// The fake theme page: the captured theme panel over a pull request, in the theme the
// fake user saved. Like Azure DevOps, the page carries only that theme's palette, in a
// `:root` style, and marks the body with the theme's class. The theme panel's
// save, a PATCH of the user's global settings, changes the saved theme.
import type {
  FakeRequest,
  FakeResponse,
  FakeSiteAction,
} from "../../shared/dev/fake-site/server.ts";
import { fixtureReader, htmlResponse, jsonResponse } from "../../shared/dev/fake-site/server.ts";
import path from "node:path";

const LIGHT_THEME_ID = "ms.vss-web.vsts-theme";
const DARK_THEME_ID = "ms.vss-web.vsts-theme-dark";
const THEME_PATH = "/fake-org/_theme";
const THEME_SETTING_KEY = "WebPlatform/Theme";
const HTTP_OK = 200;
const THEME_CLASS_DELAY_MS = 500;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;

const readFixture = fixtureReader(path.join(import.meta.dirname, ".."));

/** The captured Dark palette is `:root { … }` in the page CSS; Light swaps its neutrals. */
const LIGHT_NEUTRALS: Record<string, string> = {
  "0": "255, 255, 255",
  "10": "218, 218, 218",
  "100": "0, 0, 0",
  "2": "248, 248, 248",
  "20": "200, 200, 200",
  "30": "166, 166, 166",
  "4": "244, 244, 244",
  "6": "239, 239, 239",
  "60": "102, 102, 102",
  "70": "71, 71, 71",
  "8": "234, 234, 234",
  "80": "51, 51, 51",
};

let savedThemeId = DARK_THEME_ID;

function capturedCss(): { darkRoot: string; rest: string } {
  const css = readFixture("theme.css");
  const darkRoot = /^:root \{ --palette-.*\}$/mu.exec(css)?.[0] ?? ":root {}";
  return { darkRoot, rest: css.replace(darkRoot, "") };
}

function rootStyleOf(themeId: string, darkRoot: string): string {
  if (themeId === DARK_THEME_ID) {
    return darkRoot;
  }
  return darkRoot.replaceAll(
    /--palette-neutral-(?<step>\d+): [\d, ]+;/gu,
    (whole, step: string) => `--palette-neutral-${step}: ${LIGHT_NEUTRALS[step] ?? ""};`,
  );
}

/** A page that just loaded marks its theme with one body class, late, and no `data-theme`. */
function themeClassOf(themeId: string): string {
  return themeId === DARK_THEME_ID ? "ms-vss-web-vsts-theme-dark" : "ms-vss-web-vsts-theme";
}

function themePage(): FakeResponse {
  const { darkRoot, rest } = capturedCss();
  return htmlResponse(`<!doctype html>
<meta charset="utf-8">
<title>Fake Azure DevOps: theme</title>
<style>${rest}</style>
<style type="text/css">${rootStyleOf(savedThemeId, darkRoot)}</style>
<body class="lwp"><p>Loading…</p>
<script type="module">
  import { buildFixtureDom } from "/__dev/fixture-dom.js";
  const response = await fetch("/fake-site/theme.html");
  const html = (await response.text())
    .replace(/^<body\\b/u, "<div")
    .replace(/<\\/body>\\s*$/u, "</div>");
  const root = buildFixtureDom(document, html);
  document.body.replaceChildren(...(root === null ? [] : [root]));
  // Azure DevOps marks the theme on the body after the script has started.
  setTimeout(() => document.body.classList.add(${JSON.stringify(themeClassOf(savedThemeId))}), ${String(THEME_CLASS_DELAY_MS)});
  if (new URLSearchParams(location.search).get("panel") === "closed") {
    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      dialog.remove();
    }
  }
</script>
</body>`);
}

function saveTheme(request: FakeRequest): FakeResponse {
  const body: unknown = JSON.parse(request.body);
  const themeId: unknown =
    typeof body === "object" && body !== null ? Reflect.get(body, THEME_SETTING_KEY) : undefined;
  if (themeId !== LIGHT_THEME_ID && themeId !== DARK_THEME_ID) {
    return jsonResponse({ message: `Unknown theme ${String(themeId)}` }, HTTP_BAD_REQUEST);
  }
  savedThemeId = themeId;
  return { body: "", contentType: "text/plain", status: HTTP_NO_CONTENT };
}

/** The theme page, its fixture and the theme save, or null for another request. */
function themeResponse(request: FakeRequest): FakeResponse | null {
  const { pathname } = request.url;
  if (pathname === THEME_PATH) {
    return themePage();
  }
  if (pathname === "/fake-site/theme.html") {
    return { body: readFixture("theme.html"), contentType: "text/html", status: HTTP_OK };
  }
  if (pathname === "/fake-org/_apis/Settings/Entries/globalme" && request.method === "PATCH") {
    return saveTheme(request);
  }
  return null;
}

/** The dev action: the theme the fake user saved, as Azure DevOps's own panel would. */
const themeAction: FakeSiteAction = {
  description: "Saves a theme for the fake user, as the theme panel would: light or dark.",
  example: "theme=light",
  name: "save-theme",
  run: (query) => {
    savedThemeId = query.get("theme") === "light" ? LIGHT_THEME_ID : DARK_THEME_ID;
    return { savedThemeId };
  },
};

export { THEME_PATH, themeAction, themeResponse };
