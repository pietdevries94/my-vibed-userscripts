// Azure DevOps's own tooltip for elements the script marks with data-fix-ado-tooltip: its dark
// box, in its portal host, so the site's CSS styles it as it styles "More options". It shows a
// moment after the pointer comes over the element, or at once on keyboard focus, below the
// element, and goes on leaving or Escape. While it shows, the element is described by it.

const TOOLTIP_ATTRIBUTE = "data-fix-ado-tooltip";
const TOOLTIP_ID = "fix-ado-tooltip";
/** The gap between the element and the tooltip below it. */
const GAP_PX = 8;
/** How long the pointer rests on the element before the tooltip shows, as Azure DevOps waits. */
const HOVER_DELAY_MS = 500;

interface TooltipOptions {
  hoverDelayMs?: number;
}

function createTooltip(document: Document, text: string): HTMLElement {
  const portal = Object.assign(document.createElement("div"), {
    className: "bolt-portal absolute-fill",
  });
  portal.innerHTML =
    '<div class="bolt-callout absolute bolt-tooltip" role="tooltip"><div class="bolt-callout-content"><div class="bolt-tooltip-content body-m"></div></div></div>';
  const callout = portal.querySelector<HTMLElement>(".bolt-callout");
  const content = portal.querySelector(".bolt-tooltip-content");
  if (callout !== null && content !== null) {
    callout.id = TOOLTIP_ID;
    content.textContent = text;
  }
  return portal;
}

/** Centres the tooltip below the element, inside the window. */
function place(tooltip: HTMLElement, trigger: Element): void {
  const callout = tooltip.querySelector<HTMLElement>(".bolt-callout");
  const view = trigger.ownerDocument.defaultView;
  if (callout === null || view === null) {
    return;
  }
  const box = trigger.getBoundingClientRect();
  const width = callout.offsetWidth;
  const left = Math.min(
    Math.max(GAP_PX, box.left + box.width / 2 - width / 2),
    view.innerWidth - width - GAP_PX,
  );
  Object.assign(callout.style, {
    left: `${left}px`,
    position: "fixed",
    top: `${box.bottom + GAP_PX}px`,
  });
}

/** Shows one tooltip at a time, and takes it away. */
function createShower(document: Document): { show: (trigger: Element) => void; hide: () => void } {
  let shown: { tooltip: HTMLElement; trigger: Element } | null = null;

  function hide(): void {
    shown?.tooltip.remove();
    shown?.trigger.removeAttribute("aria-describedby");
    shown = null;
  }

  return {
    hide,
    show(trigger) {
      hide();
      const tooltip = createTooltip(document, trigger.getAttribute(TOOLTIP_ATTRIBUTE) ?? "");
      (document.querySelector(".bolt-portal-host") ?? document.body).append(tooltip);
      place(tooltip, trigger);
      trigger.setAttribute("aria-describedby", TOOLTIP_ID);
      shown = { tooltip, trigger };
    },
  };
}

type Listeners = [string, (event: Event) => void][];
type PageWindow = NonNullable<Document["defaultView"]>;

/** The element with a tooltip that the event came from, or null. Checked against the page's own
 *  Element: a userscript's globals can be another window's. */
function triggerOf(view: PageWindow | null, event: Event): Element | null {
  return view !== null && event.target instanceof view.Element
    ? event.target.closest(`[${TOOLTIP_ATTRIBUTE}]`)
    : null;
}

/** True when the pointer or focus moves to a place outside the element. */
function isLeaving(trigger: Element, event: Event): boolean {
  const view = trigger.ownerDocument.defaultView;
  const next = "relatedTarget" in event ? event.relatedTarget : null;
  return !(view !== null && next instanceof view.Node && trigger.contains(next));
}

/** Shows the tooltip a moment after the pointer comes over an element, at once on focus. */
function createHover(
  view: PageWindow | null,
  shower: ReturnType<typeof createShower>,
  hoverDelayMs: number,
): { onPointerOver: (event: Event) => void; hide: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hovered: Element | null = null;
  const hide = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    hovered = null;
    shower.hide();
  };
  return {
    hide,
    onPointerOver(event) {
      const trigger = triggerOf(view, event);
      if (trigger !== null && trigger !== hovered) {
        hide();
        hovered = trigger;
        timer = setTimeout(() => {
          shower.show(trigger);
        }, hoverDelayMs);
      }
    },
  };
}

/** The page's events that show and hide the tooltip, and a function that hides it. */
function createListeners(
  document: Document,
  hoverDelayMs: number,
): { listeners: Listeners; hide: () => void } {
  const shower = createShower(document);
  const view = document.defaultView;
  const { hide, onPointerOver } = createHover(view, shower, hoverDelayMs);
  const onLeave = (event: Event): void => {
    const trigger = triggerOf(view, event);
    if (trigger !== null && isLeaving(trigger, event)) {
      hide();
    }
  };
  const onFocusIn = (event: Event): void => {
    const trigger = triggerOf(view, event);
    if (trigger !== null) {
      shower.show(trigger);
    }
  };
  const onKeyDown = (event: Event): void => {
    if ("key" in event && event.key === "Escape") {
      hide();
    }
  };
  const listeners: Listeners = [
    ["pointerover", onPointerOver],
    ["pointerout", onLeave],
    ["focusin", onFocusIn],
    ["focusout", onLeave],
    ["keydown", onKeyDown],
  ];
  return { hide, listeners };
}

/** Pages whose tooltips run, so a second feature that starts them adds nothing. */
const startedDocuments = new WeakSet<Document>();

/** Starts the tooltips, once per page. Returns a function that stops them and takes a shown one
 *  away; for a page whose tooltips already ran, it does nothing. */
function startTooltips(document: Document, options: TooltipOptions = {}): () => void {
  if (startedDocuments.has(document)) {
    return () => {
      // Another feature started them, and stops them.
    };
  }
  startedDocuments.add(document);
  const { hide, listeners } = createListeners(document, options.hoverDelayMs ?? HOVER_DELAY_MS);
  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener);
  }
  return () => {
    startedDocuments.delete(document);
    hide();
    for (const [type, listener] of listeners) {
      document.removeEventListener(type, listener);
    }
  };
}

/** Gives the element Azure DevOps's tooltip with this text, or takes it away for null, and starts
 *  the page's tooltips on first use. Only touches the DOM on a change. */
function showTooltip(element: Element, text: string | null): void {
  startTooltips(element.ownerDocument);
  if (text === null) {
    element.removeAttribute(TOOLTIP_ATTRIBUTE);
  } else if (element.getAttribute(TOOLTIP_ATTRIBUTE) !== text) {
    element.setAttribute(TOOLTIP_ATTRIBUTE, text);
  }
}

export { showTooltip, startTooltips };
