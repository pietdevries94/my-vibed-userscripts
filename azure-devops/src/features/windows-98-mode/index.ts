import { createWindows98Mode, showScheme } from "./windows-98-mode.ts";
import type { Feature } from "../../core/feature.ts";
import style from "./style.css";
import win98Tokens from "../../../../shared/styles/win98/tokens.css";

const windows98Mode: Feature = {
  change: { kind: "updated", version: "1.32.0" },
  description:
    "Title bars, a Start menu side bar, bevelled buttons and grey windows, Light or Dark with Azure DevOps.",
  id: "windows-98-mode",
  isOffByDefault: true,
  name: "Windows 98 mode",
  start({ document }) {
    const mode = createWindows98Mode(document);
    mode.sync({ kind: "other" }, document.location);
    // Azure DevOps marks its theme on the body after the script starts, and again when the
    // theme switches in place.
    new MutationObserver(() => {
      showScheme(document);
    }).observe(document.body, { attributeFilter: ["class", "data-theme"], attributes: true });
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
