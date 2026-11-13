import type { Feature } from "../../core/feature.ts";
import type { ThemeLooks } from "./system-theme.ts";
import { createSystemTheme } from "./system-theme.ts";

const THEME_LOOKS_KEY = "system-theme-looks";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const followSystemTheme: Feature = {
  description: "Azure DevOps shows Light or Dark to match the system.",
  // The key of the earlier menu setting, so the owner's choice stays.
  id: "follow-system-theme",
  name: "Follow system theme",
  start({ client, document, isInFrame, reloadWhenIdle }) {
    // A frame shows a run page inside a pull request; the top page follows the system.
    if (isInFrame) {
      return null;
    }
    const systemDark = globalThis.matchMedia(SYSTEM_DARK_QUERY);
    const theme = createSystemTheme({
      document,
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
    // The theme has its own observer and listener. It needs no sync.
    return null;
  },
  styles: [],
};

export { followSystemTheme };
