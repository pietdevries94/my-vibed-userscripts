// Wires the system theme to the page: the menu setting, the stored looks, the system's
// dark mode and the theme panel.
import type { AdoClient } from "./ado-client.ts";
import type { OnOffSettingOptions } from "./on-off-setting.ts";
import type { ThemeLooks } from "./system-theme.ts";
import { createOnOffSetting } from "./on-off-setting.ts";
import { createSystemTheme } from "./system-theme.ts";

const THEME_LOOKS_KEY = "system-theme-looks";
const SETTING_KEY = "follow-system-theme";
const IS_ON_BY_DEFAULT = true;
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
/** How often the script reads the system's theme, for browsers that send no change event to it. */
const SYSTEM_THEME_CHECK_INTERVAL_MS = 2000;

interface FollowSystemThemeOptions {
  client: Pick<AdoClient, "saveTheme">;
  document: Document;
  menu: OnOffSettingOptions["menu"];
  reload: () => void;
  storage: OnOffSettingOptions["storage"];
}

function followSystemTheme({
  client,
  document,
  menu,
  reload,
  storage,
}: FollowSystemThemeOptions): void {
  const systemDark = globalThis.matchMedia(SYSTEM_DARK_QUERY);
  const systemTheme = createSystemTheme({
    document,
    // The menu setting stores every flip, so the stored value is the current one.
    isOn: () => storage.get(SETTING_KEY, IS_ON_BY_DEFAULT),
    looks: {
      load: () => GM_getValue<ThemeLooks>(THEME_LOOKS_KEY, {}),
      save: (looks) => {
        GM_setValue(THEME_LOOKS_KEY, looks);
      },
    },
    onSystemThemeChange: (listener) => {
      systemDark.addEventListener("change", listener);
    },
    // A fresh query each time: a kept one may not update where its event does not arrive.
    prefersDark: () => globalThis.matchMedia(SYSTEM_DARK_QUERY).matches,
    reload,
    saveTheme: async (themeId) => client.saveTheme(themeId),
  });
  createOnOffSetting({
    defaultValue: IS_ON_BY_DEFAULT,
    key: SETTING_KEY,
    label: "Follow system theme",
    menu,
    onChange: (isOn) => {
      if (isOn) {
        void systemTheme.start();
      }
    },
    storage,
  });
  // A theme picked in Azure DevOps's theme panel: remember how it looks.
  new MutationObserver(() => {
    systemTheme.remember();
  }).observe(document.body, { attributeFilter: ["data-theme"], attributes: true });
  setInterval(() => {
    systemTheme.checkSystemTheme();
  }, SYSTEM_THEME_CHECK_INTERVAL_MS);
  void systemTheme.start();
}

export { followSystemTheme };
