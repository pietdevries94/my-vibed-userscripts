import { createSwitch, showSwitchOn } from "../../core/switch.ts";

const TOGGLE_CLASS = "fix-ado-group-toggle";
const BAR_CLASS = "fix-ado-group-toggle-bar";
const LABEL = "Group by work item";
const TABBAR_SELECTOR = ".bolt-tabbar:has(> .bolt-tabbar-tabs)";
const PAGE_CONTENT_SELECTOR = ".page-content";

interface GroupToggleState {
  isGrouped: boolean;
  onToggle: () => void;
}

/** The latest onToggle per switch, so a click always calls the one from the last sync. */
const onToggleBySwitch = new WeakMap<HTMLButtonElement, () => void>();

function createToggle(document: Document): HTMLButtonElement {
  const toggle = createSwitch(document, LABEL);
  toggle.classList.add(TOGGLE_CLASS);
  toggle.addEventListener("click", () => {
    onToggleBySwitch.get(toggle)?.();
  });
  return toggle;
}

/** In a repository list's tab bar, before its buttons. False without a tab bar. */
function placeInTabbar(document: Document, toggle: HTMLButtonElement): boolean {
  const tabbar = document.querySelector(TABBAR_SELECTOR);
  if (tabbar === null) {
    return false;
  }
  const buttons = tabbar.querySelector(":scope > .bolt-header-commandbar");
  if (buttons === null) {
    if (toggle.parentElement !== tabbar) {
      tabbar.append(toggle);
    }
  } else if (toggle.nextElementSibling !== buttons) {
    buttons.before(toggle);
  }
  return true;
}

/** The bar above the lists, as the first child of the page content, added when missing. */
function barAboveLists(content: Element): Element {
  const bar =
    content.querySelector(`:scope > .${BAR_CLASS}`) ??
    Object.assign(content.ownerDocument.createElement("div"), { className: BAR_CLASS });
  if (content.firstElementChild !== bar) {
    content.prepend(bar);
  }
  return bar;
}

/** In a bar of its own above the lists, as the inbox has no tab bar. */
function placeAboveLists(document: Document, toggle: HTMLButtonElement): void {
  const content = document.querySelector(PAGE_CONTENT_SELECTOR);
  if (content === null) {
    toggle.remove();
    return;
  }
  const bar = barAboveLists(content);
  if (toggle.parentElement !== bar) {
    bar.append(toggle);
  }
}

/**
 * The "Group by work item" switch: in a repository list's tab bar, or above the inbox's
 * lists. `null` removes it. Only touches the DOM on a change.
 */
function showGroupToggle(document: Document, state: GroupToggleState | null): void {
  const shown = document.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (state === null) {
    shown?.remove();
    document.querySelector(`.${BAR_CLASS}`)?.remove();
    return;
  }
  const toggle = shown ?? createToggle(document);
  if (!placeInTabbar(document, toggle)) {
    placeAboveLists(document, toggle);
  }
  onToggleBySwitch.set(toggle, state.onToggle);
  showSwitchOn(toggle, state.isGrouped);
}

export { showGroupToggle };
