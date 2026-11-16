const FEED_SELECTOR = ".activity-feed-list";
const FILTER_SELECTOR = ".repos-activity-filter-dropdown";
const BUTTON_CLASS = "fix-ado-activity-order";
const TEXT_CLASS = "bolt-button-text";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SORT_ICON_PATHS = ["M5 13V3M2.5 5.5L5 3l2.5 2.5", "M11 3v10M8.5 10.5L11 13l2.5-2.5"];

/** The order of the activity feed on a pull request's Overview. Azure DevOps shows newest first. */
type ActivityOrder = "oldest-first" | "newest-first";

const DEFAULT_ORDER: ActivityOrder = "oldest-first";
const LABELS: Record<ActivityOrder, string> = {
  "newest-first": "Newest first",
  "oldest-first": "Oldest first",
};

interface ActivityOrderStorage {
  /** Null until the owner picks an order. */
  load: () => ActivityOrder | null;
  save: (order: ActivityOrder) => void;
}

const flipped = (order: ActivityOrder): ActivityOrder =>
  order === "oldest-first" ? "newest-first" : "oldest-first";

/** Two arrows, one up and one down, as a 16px line icon (style.css). */
function sortIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "fix-ado-activity-order-icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  for (const data of SORT_ICON_PATHS) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", data);
    svg.append(path);
  }
  return svg;
}

function createButton(document: Document, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${BUTTON_CLASS} bolt-button enabled bolt-focus-treatment`;
  const text = document.createElement("span");
  text.className = TEXT_CLASS;
  button.append(sortIcon(document), text);
  button.addEventListener("click", onClick);
  return button;
}

/** A box with the margins each filter has. Azure DevOps's button style drops a margin on the button itself. */
function spacingBox(button: HTMLButtonElement): HTMLElement {
  const box = button.ownerDocument.createElement("div");
  box.className = "margin-bottom-16 margin-right-8 inline-flex-row";
  box.append(button);
  return box;
}

/** The sort button in the bar that holds the feed's filters, added as its first item when it is not there yet. */
function findOrAddButton(document: Document, onClick: () => void): HTMLButtonElement | null {
  const existing = document.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const filters = document.querySelector(FILTER_SELECTOR)?.parentElement;
  if (filters === null || filters === undefined) {
    return null;
  }
  const button = createButton(document, onClick);
  filters.prepend(spacingBox(button));
  return button;
}

/** Writes only what changed, to keep the page's mutation observer quiet. */
function showOrder(
  feed: HTMLElement,
  button: HTMLButtonElement | null,
  order: ActivityOrder,
): void {
  if (feed.dataset.fixAdoActivityOrder !== order) {
    feed.dataset.fixAdoActivityOrder = order;
  }
  const text = button?.querySelector(`.${TEXT_CLASS}`);
  if (
    button !== null &&
    text !== null &&
    text !== undefined &&
    text.textContent !== LABELS[order]
  ) {
    text.textContent = LABELS[order];
    button.title = `Show ${LABELS[flipped(order)].toLowerCase()}`;
  }
}

/**
 * The activity feed on a pull request's Overview, oldest first, with a sort button that flips it.
 * The rows keep their place in the DOM; the order mark on the feed turns them around (style.css).
 */
function createActivityOrder(options: { document: Document; storage: ActivityOrderStorage }): {
  sync: () => void;
} {
  const { document, storage } = options;
  let order = storage.load() ?? DEFAULT_ORDER;

  function flip(): void {
    order = flipped(order);
    storage.save(order);
    sync();
  }

  function sync(): void {
    const feed = document.querySelector<HTMLElement>(FEED_SELECTOR);
    if (feed !== null) {
      showOrder(feed, findOrAddButton(document, flip), order);
    }
  }

  return { sync };
}

export type { ActivityOrder, ActivityOrderStorage };
export { createActivityOrder };
