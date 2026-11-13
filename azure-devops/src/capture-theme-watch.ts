// Watches what Azure DevOps changes when the owner picks a theme in the theme panel:
// its requests, and the style elements and body marks it swaps. Dev file only.
// Everything it records identifies nothing: tag and attribute names, Microsoft's theme
// ids, colours, and URL shapes from `urlShape`.

const PALETTE_WORD = "palette-neutral";
const PALETTE_VALUE = /--palette-neutral-0:\s*(?<palette>[\d, ]{5,20})/u;
const THEME_ID = /^ms\.vss-[\w.-]{1,80}$/u;
const PLAIN_NAME = /^[\w.-]{1,60}$/u;
const MAX_EVENTS = 300;
const MAX_PALETTE_PATHS = 20;
const RESOURCE_BUFFER_SIZE = 5000;
const WATCHED_INITIATORS = new Set(["css", "fetch", "link", "script", "xmlhttprequest"]);
const WATCHED_ATTRIBUTES = ["class", "data-theme", "disabled", "href", "media", "style"];

/** Path segments that identify nothing: routes, Microsoft's ids and theme file names. */
const KEPT_SEGMENT =
  /^(?:_\w+|apis|Settings|Entries|me|Contribution|HierarchyQuery|dataProviders|query|ms\.vss-[\w.-]+|[\w.-]*theme[\w.-]*)$/iu;
const KEPT_QUERY_VALUE = /^(?:ms\.vss-[\w.-]+|[\d.-]+(?:preview[\d.]*)?)$/iu;

type Report = Record<string, unknown>;

const events: Report[] = [];
let panelOpenedAt: number | null = null;

/** A URL's shape: other segments become "x", query values too, and the host says only whether it is the page's own. */
function urlShape(url: string): string {
  const parsed = new URL(url, location.href);
  const host = parsed.origin === location.origin ? "page-origin" : "other-origin";
  const path = parsed.pathname
    .split("/")
    .map((segment) => (segment === "" || KEPT_SEGMENT.test(segment) ? segment : "x"))
    .join("/");
  const query = [...parsed.searchParams]
    .map(([name, value]) => `${name}=${KEPT_QUERY_VALUE.test(value) ? value : "x"}`)
    .join("&");
  return `${host}${path}${query === "" ? "" : `?${query}`}`;
}

function record(event: Report): void {
  if (panelOpenedAt !== null && events.length < MAX_EVENTS) {
    events.push({ at: Math.round(performance.now() - panelOpenedAt), ...event });
  }
}

/** The value of the palette's darkest neutral, which tells the themes apart. */
function paletteIn(text: string): string | null {
  return PALETTE_VALUE.exec(text)?.groups?.palette?.trim() ?? null;
}

function tagOf(element: Element | null): string | null {
  return element?.tagName.toLowerCase() ?? null;
}

function sourceShape(element: Element): string | null {
  const source = element.getAttribute("href") ?? element.getAttribute("src");
  return source === null ? null : urlShape(source);
}

function describeElement(element: Element): Report {
  const isStyle = element instanceof HTMLStyleElement;
  return {
    attributes: element.getAttributeNames(),
    classes: [...element.classList].filter((name) => PLAIN_NAME.test(name)),
    palette: isStyle ? paletteIn(element.textContent) : null,
    parent: tagOf(element.parentElement),
    tag: tagOf(element),
    textLength: isStyle ? element.textContent.length : null,
    url: sourceShape(element),
  };
}

function describeNodes(nodes: NodeList): Report[] {
  return [...nodes]
    .filter((node): node is Element => node instanceof Element)
    .map((element) => describeElement(element));
}

function themeIdOf(element: Element): string | null {
  const value = element instanceof HTMLElement ? (element.dataset.theme ?? "") : "";
  return THEME_ID.test(value) ? value : null;
}

function recordAttributeChange(target: Element, attribute: string | null): void {
  record({ attribute, kind: "attribute", tag: tagOf(target), themeId: themeIdOf(target) });
}

function recordStyleText(node: Node): void {
  const style = node instanceof HTMLStyleElement ? node : node.parentElement;
  if (style instanceof HTMLStyleElement) {
    record({
      kind: "style text",
      palette: paletteIn(style.textContent),
      parent: tagOf(style.parentElement),
    });
  }
}

function recordChildren(mutation: MutationRecord): void {
  const added = describeNodes(mutation.addedNodes);
  const removed = describeNodes(mutation.removedNodes);
  const touchesStyles = [...added, ...removed].some(({ tag }) => tag === "style" || tag === "link");
  if (mutation.target === document.head || touchesStyles) {
    const target = mutation.target instanceof Element ? tagOf(mutation.target) : null;
    record({ added, kind: "children", removed, target });
  }
}

function recordMutation(mutation: MutationRecord): void {
  if (mutation.type === "attributes" && mutation.target instanceof Element) {
    recordAttributeChange(mutation.target, mutation.attributeName);
  } else if (mutation.type === "characterData" || mutation.target instanceof HTMLStyleElement) {
    recordStyleText(mutation.target);
  } else {
    recordChildren(mutation);
  }
}

function recordRequests(list: PerformanceObserverEntryList): void {
  for (const entry of list.getEntries()) {
    if (entry instanceof PerformanceResourceTiming && WATCHED_INITIATORS.has(entry.initiatorType)) {
      record({ initiator: entry.initiatorType, kind: "request", url: urlShape(entry.name) });
    }
  }
}

/** Starts watching; events count from the moment the theme panel opens. */
function startThemeWatch(): void {
  if (typeof MutationObserver === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }
  performance.setResourceTimingBufferSize(RESOURCE_BUFFER_SIZE);
  new MutationObserver((mutations) => {
    if (panelOpenedAt === null && document.querySelector(".theme-panel") !== null) {
      panelOpenedAt = performance.now();
    }
    for (const mutation of mutations) {
      recordMutation(mutation);
    }
  }).observe(document.documentElement, {
    attributeFilter: WATCHED_ATTRIBUTES,
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  new PerformanceObserver((list) => {
    recordRequests(list);
  }).observe({ type: "resource" });
}

/** The text of a style sheet, or null when it is another origin's. */
function sheetText(sheet: CSSStyleSheet): string | null {
  try {
    return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
  } catch {
    return null;
  }
}

function describeSheet(sheet: CSSStyleSheet, palette: string): Report {
  return {
    adopted: document.adoptedStyleSheets.includes(sheet),
    disabled: sheet.disabled,
    media: sheet.media.mediaText,
    owner: sheet.ownerNode instanceof Element ? describeElement(sheet.ownerNode) : null,
    palette,
    ruleCount: sheet.cssRules.length,
  };
}

/** Every style sheet with a palette: where it sits and which theme it holds. */
function paletteSources(): Report[] {
  return [...document.styleSheets, ...document.adoptedStyleSheets].flatMap((sheet) => {
    const palette = paletteIn(sheetText(sheet) ?? "");
    return palette === null ? [] : [describeSheet(sheet, palette)];
  });
}

function shownKey(parent: object, key: string): string {
  if (Array.isArray(parent)) {
    return "[]";
  }
  return PLAIN_NAME.test(key) ? key : "x";
}

/** Key paths in JSON that lead to a palette. Keys that are not plain names become "x". */
function palettePaths(value: unknown, path: string[], found: string[]): void {
  if (typeof value === "string" && value.includes(PALETTE_WORD)) {
    found.push(path.join("."));
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, shownKey(value, key)];
    if (key.includes(PALETTE_WORD) && found.length < MAX_PALETTE_PATHS) {
      found.push(childPath.join("."));
    }
    palettePaths(child, childPath, found);
  }
}

function jsonPalettePaths(text: string): string[] | null {
  try {
    const found: string[] = [];
    palettePaths(JSON.parse(text), [], found);
    return found.slice(0, MAX_PALETTE_PATHS);
  } catch {
    return null;
  }
}

/** Scripts whose text holds a palette, such as theme data in the page's JSON. */
function paletteScripts(): Report[] {
  return [...document.querySelectorAll("script")]
    .filter((script) => script.textContent.includes(PALETTE_WORD))
    .map((script) => ({
      attributes: script.getAttributeNames(),
      id: PLAIN_NAME.test(script.id) ? script.id : null,
      palettePaths: jsonPalettePaths(script.textContent),
      textLength: script.textContent.length,
      type: script.type,
    }));
}

function themeWatchReport(): Report {
  return {
    events,
    paletteScripts: paletteScripts(),
    paletteSources: paletteSources(),
    watching: panelOpenedAt !== null,
  };
}

export { startThemeWatch, themeWatchReport, urlShape };
