import type { Feature } from "../../core/feature.ts";
import style from "./style.css";

const greyDrafts: Feature = {
  change: { kind: "new", version: "1.26.0" },
  description: "A slightly grey background on draft pull requests in the lists and the inbox.",
  id: "grey-drafts",
  name: "Grey drafts",
  start: () => null,
  styles: [style],
};

export { greyDrafts };
