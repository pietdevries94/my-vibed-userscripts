const FEED_SELECTOR = ".activity-feed-list";
/** Azure DevOps's class on a box that can scroll down. The Overview sits in more than one. */
const SCROLLER_SELECTOR = ".v-scroll-auto";
const BUTTON_CLASS = "fix-ado-scroll-to-bottom";
const LABEL = "Scroll to bottom";
/** Closer to the bottom than this counts as there. */
const BOTTOM_MARGIN = 16;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ARROW_DOWN_PATH = "M8 3v10M3.5 8.5L8 13l4.5-4.5";

/** An arrow down, as a 16px line icon (style.css). */
function arrowDownIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 16 16");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", ARROW_DOWN_PATH);
  svg.append(path);
  return svg;
}

/** The box around the feed that has more than fits its height, or null when everything fits. */
function scrollerOf(feed: Element): HTMLElement | null {
  let box = feed.parentElement?.closest<HTMLElement>(SCROLLER_SELECTOR) ?? null;
  while (box !== null && box.scrollHeight <= box.clientHeight) {
    box = box.parentElement?.closest<HTMLElement>(SCROLLER_SELECTOR) ?? null;
  }
  return box;
}

function createButton(document: Document, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.title = LABEL;
  button.setAttribute("aria-label", LABEL);
  button.append(arrowDownIcon(document));
  button.addEventListener("click", onClick);
  return button;
}

const isAtBottom = (scroller: HTMLElement): boolean =>
  scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= BOTTOM_MARGIN;

/**
 * A button on a pull request's Overview that scrolls to its bottom. It floats in the corner
 * of the window (style.css) and shows only while there is something further down.
 */
function createScrollToBottom(options: { document: Document }): { sync: () => void } {
  const { document } = options;
  let button: HTMLButtonElement | null = null;

  function scrollerOfOverview(): HTMLElement | null {
    const feed = document.querySelector(FEED_SELECTOR);
    return feed === null ? null : scrollerOf(feed);
  }

  function scrollToBottom(): void {
    const scroller = scrollerOfOverview();
    scroller?.scrollTo({ behavior: "smooth", top: scroller.scrollHeight });
  }

  /** The button, added to the page when it is not there. */
  function findOrAddButton(): HTMLButtonElement {
    button ??= createButton(document, scrollToBottom);
    if (!button.isConnected) {
      document.body.append(button);
    }
    return button;
  }

  /** Writes only what changed, to keep the page's mutation observer quiet. */
  function sync(): void {
    const scroller = scrollerOfOverview();
    const isShown = scroller !== null && !isAtBottom(scroller);
    if (button === null && !isShown) {
      return;
    }
    const added = findOrAddButton();
    if (added.hidden === isShown) {
      added.hidden = !isShown;
    }
  }

  // A scroll event does not bubble. Capturing on the document hears every box.
  document.addEventListener("scroll", sync, { capture: true, passive: true });
  // A window that grows or shrinks moves the bottom without any change to the page.
  document.defaultView?.addEventListener("resize", sync);

  return { sync };
}

export { createScrollToBottom };
