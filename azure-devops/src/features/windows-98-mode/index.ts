import type { Feature } from "../../core/feature.ts";
import { createWindows98Mode } from "./windows-98-mode.ts";
import style from "./style.css";

const windows98Mode: Feature = {
  change: { kind: "new", version: "1.19.0" },
  description:
    "Azure DevOps as Windows 98: title bar, Start menu side bar, bevelled buttons and grey windows.",
  id: "windows-98-mode",
  isOffByDefault: true,
  name: "Windows 98 mode",
  start({ document }) {
    const mode = createWindows98Mode(document);
    mode.sync({ kind: "other" }, document.location);
    return {
      sync({ page }) {
        mode.sync(page, document.location);
      },
    };
  },
  styles: [style],
};

export { windows98Mode };
