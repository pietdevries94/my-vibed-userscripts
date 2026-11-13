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
    prefersDark: () => systemDark.matches,
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
  // Azure DevOps marks the theme on the body after the script starts, and again when
  // the theme panel switches.
  new MutationObserver(() => {
    systemTheme.onPageChange();
  }).observe(document.body, { attributeFilter: ["class", "data-theme"], attributes: true });
  void systemTheme.start();
}

export { followSystemTheme };
