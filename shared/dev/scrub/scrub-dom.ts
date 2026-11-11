// Scrubs a page into a copy that keeps its structure and none of its values.
// Kept: tag names, class names, structural attributes, SVG geometry, and what the
// script's rules add. Dropped: script, style, iframe and similar elements.
// Every text, label and data value becomes a consistent stand-in.
import { scrubLink, scrubValue } from "./scrub-value.ts";
import type { Pseudonyms } from "./pseudonyms.ts";
import type { ScrubRules } from "./rules.ts";

interface ScrubContext {
  rules: ScrubRules;
  pseudonyms: Pseudonyms;
  document: Document;
}

const DROPPED_ELEMENTS = new Set([
  "script",
  "style",
  "iframe",
  "noscript",
  "link",
  "meta",
  "object",
  "embed",
  "template",
]);
const STRUCTURAL_ATTRIBUTES = new Set([
  "role",
  "type",
  "tabindex",
  "colspan",
  "rowspan",
  "scope",
  "dir",
  "hidden",
  "disabled",
  "focusable",
  "aria-hidden",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "aria-disabled",
  "aria-busy",
  "aria-haspopup",
  "aria-level",
  "aria-rowindex",
  "aria-colindex",
  "aria-rowcount",
  "aria-colcount",
  "aria-setsize",
  "aria-posinset",
  "aria-sort",
  "aria-current",
  "aria-orientation",
  "aria-live",
]);
const SVG_GEOMETRY_ATTRIBUTES = new Set([
  "viewBox",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "clip-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "xmlns",
]);
const SCRUBBED_ATTRIBUTES = new Set([
  "aria-label",
  "alt",
  "title",
  "placeholder",
  "value",
  "name",
  "for",
]);
const SAFE_STRUCTURAL_VALUE = /^[\w-]{0,20}$/u;
const SAFE_STYLE = /^[\w\s:;.,%()#-]*$/u;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function fieldOf(element: Element, attribute?: string): string {
  const [firstClass] = element.classList;
  const selector =
    firstClass === undefined ? element.localName : `${element.localName}.${firstClass}`;
  return attribute === undefined ? selector : `${selector} @${attribute}`;
}

function keptAttributeValue(
  element: Element,
  { name, value }: Attr,
  context: ScrubContext,
): string | null {
  if (name === "class" || context.rules.keepAttributes.includes(name)) {
    return value;
  }
  if (name === "style") {
    return SAFE_STYLE.test(value) && !value.includes("url(") ? value : null;
  }
  if (STRUCTURAL_ATTRIBUTES.has(name)) {
    return SAFE_STRUCTURAL_VALUE.test(value) ? value : null;
  }
  if (element.namespaceURI === SVG_NAMESPACE && SVG_GEOMETRY_ATTRIBUTES.has(name)) {
    return /https?:|data:/iu.test(value) ? null : value;
  }
  return null;
}

/** Ids, links and dates: replaced by their own kind of stand-in. Null for other attributes. */
function scrubSpecialAttribute(
  element: Element,
  { name, value }: Attr,
  context: ScrubContext,
): string | null {
  const field = fieldOf(element, name);
  if (name === "id") {
    return context.rules.keepIdPatterns.some((pattern) => pattern.test(value))
      ? value
      : scrubValue(value, field, context);
  }
  if (name === "href" || name === "src") {
    return scrubLink(value, field, context);
  }
  return name === "datetime" ? context.pseudonyms.date(value, field) : null;
}

/** The value to write for an attribute, or null to leave the attribute out. */
function scrubAttribute(element: Element, attribute: Attr, context: ScrubContext): string | null {
  const special = scrubSpecialAttribute(element, attribute, context);
  if (special !== null) {
    return special;
  }
  const kept = keptAttributeValue(element, attribute, context);
  if (kept !== null) {
    return kept;
  }
  const { name, value } = attribute;
  const isScrubbed =
    SCRUBBED_ATTRIBUTES.has(name) || name.startsWith("data-") || name.startsWith("aria-");
  return isScrubbed ? scrubValue(value, fieldOf(element, name), context) : null;
}

function copyAttributes(source: Element, target: Element, context: ScrubContext): void {
  for (const attribute of source.attributes) {
    const scrubbed = scrubAttribute(source, attribute, context);
    if (scrubbed !== null) {
      try {
        target.setAttribute(attribute.name, scrubbed);
      } catch {
        // Not a valid attribute name for setAttribute. Leave it out.
      }
    }
  }
}

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

/** Text and elements are copied; comments and other nodes are left out. */
function scrubNode(node: Node, parentField: string, context: ScrubContext): Node | null {
  if (node.nodeType === node.TEXT_NODE) {
    return context.document.createTextNode(
      scrubValue(node.textContent ?? "", `${parentField} text`, context),
    );
  }
  return isElement(node) ? scrubElementNode(node, context) : null;
}

function scrubElementNode(element: Element, context: ScrubContext): Element | null {
  if (DROPPED_ELEMENTS.has(element.localName)) {
    return null;
  }
  const copy = context.document.createElementNS(element.namespaceURI, element.localName);
  copyAttributes(element, copy, context);
  const field = fieldOf(element);
  for (const child of element.childNodes) {
    const scrubbedChild = scrubNode(child, field, context);
    if (scrubbedChild !== null) {
      copy.append(scrubbedChild);
    }
  }
  return copy;
}

/** A scrubbed copy of `root`, built in a new document. */
function scrubElement(root: Element, rules: ScrubRules, pseudonyms: Pseudonyms): Element {
  const document = root.ownerDocument.implementation.createHTMLDocument("");
  const scrubbed = scrubElementNode(root, { document, pseudonyms, rules });
  return scrubbed ?? document.createElement("div");
}

export { scrubElement };
