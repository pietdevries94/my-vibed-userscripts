const TOGGLE_BAR_CLASS = "fix-ado-group-toggle";
const PAGE_CONTENT_SELECTOR = ".page-content";

interface GroupToggleState {
  isGrouped: boolean;
  onToggle: () => void;
}

/** The latest onToggle per button, so a click always calls the one from the last sync. */
const onToggleByButton = new WeakMap<HTMLButtonElement, () => void>();

function createToggleBar(document: Document): HTMLElement {
  const bar = document.createElement("div");
  bar.className = TOGGLE_BAR_CLASS;
  const button = document.createElement("button");
  button.type = "button";
  // Azure DevOps's own button look, so the toggle blends in.
  button.className = "bolt-button enabled subtle";
  button.textContent = "Group by work item";
  button.addEventListener("click", () => {
    onToggleByButton.get(button)?.();
  });
  bar.append(button);
  return bar;
}

/** The toggle bar as the first child of the page content, added when missing. */
function placeToggleBar(content: Element, shown: HTMLElement | null): HTMLElement {
  const bar = shown ?? createToggleBar(content.ownerDocument);
  if (content.firstElementChild !== bar) {
    content.prepend(bar);
  }
  return bar;
}

function showPressed(button: HTMLButtonElement, isPressed: boolean): void {
  const pressed = String(isPressed);
  if (button.getAttribute("aria-pressed") !== pressed) {
    button.setAttribute("aria-pressed", pressed);
  }
}

/**
 * A "Group by work item" toggle above the pull request lists. `null` removes it.
 * aria-pressed says whether the lists are grouped. Only touches the DOM on a change.
 */
function showGroupToggle(document: Document, state: GroupToggleState | null): void {
  const shown = document.querySelector<HTMLElement>(`.${TOGGLE_BAR_CLASS}`);
  const content = document.querySelector(PAGE_CONTENT_SELECTOR);
  if (state === null || content === null) {
    shown?.remove();
    return;
  }
  const button = placeToggleBar(content, shown).querySelector("button");
  if (button === null) {
    return;
  }
  onToggleByButton.set(button, state.onToggle);
  showPressed(button, state.isGrouped);
}

export { showGroupToggle };
