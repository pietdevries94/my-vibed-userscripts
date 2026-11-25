import type { Feature } from "../../core/feature.ts";
import style from "./style.css";

const greyDrafts: Feature = {
  change: { kind: "new", version: "1.26.0" },
  description:
    "Draft pull requests, and groups of only drafts, on a slightly grey background with lighter text.",
  id: "grey-drafts",
  name: "Grey drafts",
  start: () => null,
  styles: [style],
};

export { greyDrafts };
