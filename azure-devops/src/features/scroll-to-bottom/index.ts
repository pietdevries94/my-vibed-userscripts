import type { Feature } from "../../core/feature.ts";
import { createScrollToBottom } from "./scroll-to-bottom.ts";
import style from "./style.css";

const scrollToBottom: Feature = {
  change: { kind: "new", version: "1.13.0" },
  description:
    "A button in the corner of a pull request's Overview scrolls to its bottom. It hides once you are there.",
  id: "scroll-to-bottom",
  name: "Scroll to bottom on the Overview",
  start({ document, isInFrame }) {
    if (isInFrame) {
      return null;
    }
    const scrollButton = createScrollToBottom({ document });
    return {
      sync() {
        scrollButton.sync();
      },
    };
  },
  styles: [style],
};

export { scrollToBottom };
