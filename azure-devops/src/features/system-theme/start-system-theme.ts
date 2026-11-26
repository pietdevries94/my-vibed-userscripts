// Starts following the system's theme on a page: from "Match the system theme", or from
// Windows 98 mode when that setting is off, so Windows 98 mode always gets Light.
import type { FeatureContext } from "../../core/feature.ts";
import type { ThemeLooks } from "./system-theme.ts";
import { createSystemTheme } from "./system-theme.ts";

const THEME_LOOKS_KEY = "system-theme-looks";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeContext = Pick<FeatureContext, "client" | "document" | "reloadWhenIdle">;

function startSystemTheme(
  { client, document, reloadWhenIdle }: ThemeContext,
  isLightForced: () => boolean,
): void {
  const systemDark = globalThis.matchMedia(SYSTEM_DARK_QUERY);
  const theme = createSystemTheme({
    document,
    isLightForced,
    looks: {
      load: () => GM_getValue<ThemeLooks>(THEME_LOOKS_KEY, {}),
      save: (looks) => {
        GM_setValue(THEME_LOOKS_KEY, looks);
      },
    },
    onSystemThemeChange: (listener) => {
      systemDark.addEventListener("change", listener);
    },
    prefersDark: () => systemDark.matches,
    reload: reloadWhenIdle,
    saveTheme: async (themeId) => client.saveTheme(themeId),
  });
  // Azure DevOps marks the theme on the body after the script starts, and again when
  // the theme panel switches.
  new MutationObserver(() => {
    theme.onPageChange();
  }).observe(document.body, { attributeFilter: ["class", "data-theme"], attributes: true });
  void theme.start();
}

export { startSystemTheme };
