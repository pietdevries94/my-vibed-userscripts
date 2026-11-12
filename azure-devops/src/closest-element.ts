const ELEMENT_NODE = 1;

function isElement(target: EventTarget | null): target is Element {
  return target !== null && "nodeType" in target && target.nodeType === ELEMENT_NODE;
}

/** The nearest element from an event target up that matches `selector`, or null. */
function closestElement(target: EventTarget | null, selector: string): Element | null {
  return isElement(target) ? target.closest(selector) : null;
}

export { closestElement };
