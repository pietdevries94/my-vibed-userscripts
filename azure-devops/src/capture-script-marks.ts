// Takes what this script added out of a page before it is captured. Dev file only.
import { PIPELINE_STATUS_ICON_CLASS } from "./pipeline-status-icon.ts";

/** Elements this script adds to a page. */
const ADDED_ELEMENT_SELECTOR = [
  `.${PIPELINE_STATUS_ICON_CLASS}`,
  ".fix-ado-days-in-column",
  ".fix-ado-days-toggle",
].join(", ");

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function hasInlineStyle(element: Element): element is Element & ElementCSSInlineStyle {
  return "style" in element;
}

/**
 * A copy of `root` without what this script added: status icons, days-in-column
 * bars and toggles, data-fix-ado-*
 * attributes and --fix-ado-* style properties. The fixture shows the page as
 * Azure DevOps rendered it.
 */
function withoutScriptMarks(root: Element): Element {
  const copy = root.cloneNode(true);
  if (!isElement(copy)) {
    return root;
  }
  for (const added of copy.querySelectorAll(ADDED_ELEMENT_SELECTOR)) {
    added.remove();
  }
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    removeScriptMarks(element);
  }
  return copy;
}

function removeScriptMarks(element: Element): void {
  for (const name of element
    .getAttributeNames()
    .filter((attribute) => attribute.startsWith("data-fix-ado-"))) {
    element.removeAttribute(name);
  }
  if (hasInlineStyle(element)) {
    for (const property of [...element.style].filter((name) => name.startsWith("--fix-ado-"))) {
      element.style.removeProperty(property);
    }
    if (element.getAttribute("style") === "") {
      element.removeAttribute("style");
    }
  }
}

export { withoutScriptMarks };
