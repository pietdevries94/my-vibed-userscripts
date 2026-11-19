// Takes what this script added out of a page before it is captured. Dev file only.

/** The start of every class this script gives an element. */
const SCRIPT_CLASS_PREFIX = "fix-ado-";
/**
 * The outer element of each part this script creates, such as icons, chips, buttons
 * and the settings panel. Azure DevOps' own elements can carry a fix-ado-* class too,
 * so a fix-ado-* class alone does not mark an element as the script's.
 */
const ADDED_ELEMENT_CLASSES = [
  "fix-ado-activity-order",
  "fix-ado-add-reviewer",
  "fix-ado-days-in-column",
  "fix-ado-days-toggle",
  "fix-ado-expand-all-threads",
  "fix-ado-first-unread-box",
  "fix-ado-first-unread",
  "fix-ado-issue-count",
  "fix-ado-joined-line",
  "fix-ado-last-page-reload",
  "fix-ado-new-chip",
  "fix-ado-next-unread",
  "fix-ado-overview-issues",
  "fix-ado-pipeline-panel",
  "fix-ado-pipeline-status",
  "fix-ado-pipeline-tab",
  "fix-ado-published-since",
  "fix-ado-push-toggle",
  "fix-ado-review-add",
  "fix-ado-review-card-row",
  "fix-ado-review-dialog",
  "fix-ado-review-editor-card",
  "fix-ado-review-file-pending",
  "fix-ado-review-header",
  "fix-ado-review-spacer-row",
  "fix-ado-review-tree-row",
  "fix-ado-scroll-to-bottom",
  "fix-ado-settings",
  "fix-ado-settings-item",
  "fix-ado-star",
  "fix-ado-star-picker-list",
  "fix-ado-starred-chips",
  "fix-ado-starred-reviewers",
  "fix-ado-thread-chip",
  "fix-ado-thread-toggle",
  "fix-ado-warning-text",
];
const ADDED_ELEMENT_SELECTOR = ADDED_ELEMENT_CLASSES.map((name) => `.${name}`).join(", ");

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function hasInlineStyle(element: Element): element is Element & ElementCSSInlineStyle {
  return "style" in element;
}

/**
 * A copy of `root` without what this script added: the parts it created, and the
 * fix-ado-* classes, data-fix-ado-* attributes and --fix-ado-* style properties
 * it put on the page's own elements. The fixture shows the page as Azure DevOps
 * rendered it, so the script adds its own parts afresh on the fake site.
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

function removeScriptClasses(element: Element): void {
  for (const name of [...element.classList].filter((className) =>
    className.startsWith(SCRIPT_CLASS_PREFIX),
  )) {
    element.classList.remove(name);
  }
  if (element.getAttribute("class") === "") {
    element.removeAttribute("class");
  }
}

function removeScriptAttributes(element: Element): void {
  for (const name of element
    .getAttributeNames()
    .filter((attribute) => attribute.startsWith("data-fix-ado-"))) {
    element.removeAttribute(name);
  }
}

function removeScriptStyleProperties(element: Element): void {
  if (!hasInlineStyle(element)) {
    return;
  }
  for (const property of [...element.style].filter((name) => name.startsWith("--fix-ado-"))) {
    element.style.removeProperty(property);
  }
  if (element.getAttribute("style") === "") {
    element.removeAttribute("style");
  }
}

function removeScriptMarks(element: Element): void {
  removeScriptClasses(element);
  removeScriptAttributes(element);
  removeScriptStyleProperties(element);
}

export { withoutScriptMarks };
