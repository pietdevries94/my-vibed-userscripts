const FEED_SELECTOR = ".activity-feed-list";
/** Azure DevOps's class on a box that can scroll down. The Overview sits in more than one. */
const SCROLLER_SELECTOR = ".v-scroll-auto";
const BUTTON_CLASS = "fix-ado-scroll-to-bottom";
const LABEL = "Scroll to bottom";
/** Closer to the bottom than this counts as there. */
const BOTTOM_MARGIN = 16;
/** The follow ends when the Overview neither scrolls nor grows for this long. */
const FOLLOW_QUIET_MS = 2000;
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

function createButton(
  document: Document,
  onClick: () => void,
  onBlur: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.title = LABEL;
  button.setAttribute("aria-label", LABEL);
  button.append(arrowDownIcon(document));
  button.addEventListener("click", onClick);
  button.addEventListener("blur", onBlur);
  return button;
}

function overviewScrollerOf(document: Document): HTMLElement | null {
  const feed = document.querySelector(FEED_SELECTOR);
  return feed === null ? null : scrollerOf(feed);
}

const isAtBottom = (scroller: HTMLElement): boolean =>
  scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= BOTTOM_MARGIN;

/** True while there is more below, or while the button has focus, so focus does not fall to the page. */
function isButtonWanted(scroller: HTMLElement | null, button: HTMLButtonElement | null): boolean {
  const hasFocus = button !== null && button.ownerDocument.activeElement === button;
  return scroller !== null && (!isAtBottom(scroller) || hasFocus);
}

/** A smooth scroll, or a jump when the owner asks for reduced motion. */
function scrollBehaviorOf(scroller: HTMLElement): ScrollBehavior {
  const view = scroller.ownerDocument.defaultView;
  const reducesMotion = view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return reducesMotion ? "instant" : "smooth";
}

/** What the owner does to scroll by hand. Any of them ends the follow. */
const OWNER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"];

interface BottomFollow {
  /** Scrolls to the bottom and starts following it. */
  start: (scroller: HTMLElement) => void;
  /** Scrolls again when the scroller grew since the last scroll. Ends the follow once it is quiet. */
  step: (scroller: HTMLElement | null, isScrollEvent: boolean) => void;
  stop: () => void;
}

/**
 * Azure DevOps loads the feed's content as it comes into view, so the Overview grows after
 * a scroll to its bottom. The follow scrolls again on every growth, until the Overview
 * neither scrolls nor grows for a while, or the owner scrolls by hand.
 */
function createBottomFollow(now: () => number): BottomFollow {
  /** The height last scrolled to, and when the follow last saw a scroll or growth. */
  let followed: { height: number; lastActiveAt: number } | null = null;

  function start(scroller: HTMLElement): void {
    followed = { height: scroller.scrollHeight, lastActiveAt: now() };
    scroller.scrollTo({ behavior: scrollBehaviorOf(scroller), top: scroller.scrollHeight });
  }

  function step(scroller: HTMLElement | null, isScrollEvent: boolean): void {
    if (followed === null) {
      return;
    }
    if (scroller === null || now() - followed.lastActiveAt > FOLLOW_QUIET_MS) {
      followed = null;
    } else if (scroller.scrollHeight !== followed.height) {
      start(scroller);
    } else if (isScrollEvent) {
      followed.lastActiveAt = now();
    }
  }

  return {
    start,
    step,
    stop: () => {
      followed = null;
    },
  };
}

interface PageEvents {
  onScroll: (event: Event) => void;
  onResize: (event: Event) => void;
  onOwnerScroll: (event: Event) => void;
}

function listen(document: Document, events: PageEvents): void {
  // A scroll event does not bubble. Capturing on the document hears every box.
  document.addEventListener("scroll", events.onScroll, { capture: true, passive: true });
  // A window that grows or shrinks moves the bottom without any change to the page.
  document.defaultView?.addEventListener("resize", events.onResize);
  for (const type of OWNER_SCROLL_EVENTS) {
    document.addEventListener(type, events.onOwnerScroll, { capture: true, passive: true });
  }
}

/**
 * A button on a pull request's Overview that scrolls to its bottom, and follows it while
 * more content loads. It floats in the corner of the window (style.css) and shows only
 * while there is something further down.
 */
function createScrollToBottom(options: { document: Document; now: () => number }): {
  sync: () => void;
} {
  const { document } = options;
  const follow = createBottomFollow(options.now);
  let button: HTMLButtonElement | null = null;

  function scrollToBottom(): void {
    const scroller = overviewScrollerOf(document);
    if (scroller !== null) {
      follow.start(scroller);
    }
  }

  /** Writes only what changed, to keep the page's mutation observer quiet. */
  function showOrHideButton(scroller: HTMLElement | null): void {
    const isShown = isButtonWanted(scroller, button);
    if (button === null && !isShown) {
      return;
    }
    button ??= createButton(document, scrollToBottom, sync);
    if (!button.isConnected) {
      document.body.append(button);
    }
    if (button.hidden === isShown) {
      button.hidden = !isShown;
    }
  }

  function sync(event?: Event): void {
    const scroller = overviewScrollerOf(document);
    follow.step(scroller, event?.type === "scroll");
    showOrHideButton(scroller);
  }

  listen(document, {
    onOwnerScroll: (event) => {
      if (event.target !== button) {
        follow.stop();
      }
    },
    onResize: sync,
    onScroll: sync,
  });
  return {
    sync: () => {
      sync();
    },
  };
}

export { createScrollToBottom };
