import type { Feature } from "../../core/feature.ts";
import { createWindows98Mode } from "./windows-98-mode.ts";
import { startSystemTheme } from "../system-theme/start-system-theme.ts";
import style from "./style.css";
import win98Tokens from "../../../../shared/styles/win98/tokens.css";

// The storage key of "Match the system theme"'s on/off choice, on by default.
const FOLLOW_SYSTEM_THEME_ID = "follow-system-theme";

const windows98Mode: Feature = {
  change: { kind: "new", version: "1.19.0" },
  description:
    "Title bars, a Start menu side bar, bevelled buttons and grey windows. Always Light.",
  id: "windows-98-mode",
  isOffByDefault: true,
  name: "Windows 98 mode",
  start(context) {
    const { document } = context;
    // Azure DevOps's dark palette breaks the look, so it is Light. With "Match the system
    // theme" on, that setting keeps it Light.
    if (!context.isInFrame && !GM_getValue<boolean>(FOLLOW_SYSTEM_THEME_ID, true)) {
      startSystemTheme(context, () => true);
    }
    const mode = createWindows98Mode(document);
    mode.sync({ kind: "other" }, document.location);
    return {
      sync({ page }) {
        mode.sync(page, document.location);
      },
    };
  },
  styles: [win98Tokens, style],
  tag: "WIP",
};

export { windows98Mode };
