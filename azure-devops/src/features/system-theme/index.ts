import type { Feature } from "../../core/feature.ts";
import { startSystemTheme } from "./start-system-theme.ts";

// The storage key and default of Windows 98 mode's on/off choice. Saving a choice reloads the
// page, so it is read once.
const WINDOWS_98_MODE_ID = "windows-98-mode";

const followSystemTheme: Feature = {
  change: { kind: "new", version: "1.7.2" },
  description: "Switches between Light and Dark with your system. Windows 98 mode stays Light.",
  // The key of the earlier menu setting, so the owner's choice stays.
  id: "follow-system-theme",
  name: "Match the system theme",
  start(context) {
    // A frame shows a run page inside a pull request; the top page follows the system.
    if (context.isInFrame) {
      return null;
    }
    const isWindows98Mode = GM_getValue<boolean>(WINDOWS_98_MODE_ID, false);
    startSystemTheme(context, () => isWindows98Mode);
    // The theme has its own observer and listener. It needs no sync.
    return null;
  },
  styles: [],
};

export { followSystemTheme };
