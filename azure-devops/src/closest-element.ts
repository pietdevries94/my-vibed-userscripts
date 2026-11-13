const ELEMENT_NODE = 1;

function isElement(target: EventTarget | null): target is Element {
  return target !== null && "nodeType" in target && target.nodeType === ELEMENT_NODE;
}

/** The nearest element from an event target up that matches `selector`, or null. */
function closestElement(target: EventTarget | null, selector: string): Element | null {
  return isElement(target) ? target.closest(selector) : null;
}

function isHtmlElement(element: Element): element is HTMLElement {
  return "dataset" in element;
}

/** As `closestElement`, for an HTML element. */
function closestHtmlElement(target: EventTarget | null, selector: string): HTMLElement | null {
  const found = closestElement(target, selector);
  return found !== null && isHtmlElement(found) ? found : null;
}

export { closestElement, closestHtmlElement, isElement };
