// A switch on the pull request lists, such as "Group by work item": in a repository list's
// tab bar, or in a bar of its own above the inbox's lists. switch.css styles it.
import { createSwitch, showSwitchOn } from "./switch.ts";

const BAR_CLASS = "fix-ado-list-switch-bar";
const TABBAR_SELECTOR = ".bolt-tabbar:has(> .bolt-tabbar-tabs)";
const PAGE_CONTENT_SELECTOR = ".page-content";

/** Which switch: its own class, so each feature finds its switch again, and its label. */
interface ListSwitch {
  className: string;
  label: string;
}

interface ListSwitchState {
  isOn: boolean;
  onToggle: () => void;
}

/** The latest onToggle per switch, so a click always calls the one from the last sync. */
const onToggleBySwitch = new WeakMap<HTMLButtonElement, () => void>();

function createListSwitch(document: Document, { className, label }: ListSwitch): HTMLButtonElement {
  const toggle = createSwitch(document, label);
  toggle.classList.add(className);
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
  if (toggle.parentElement === tabbar) {
    return true;
  }
  const buttons = tabbar.querySelector(":scope > .bolt-header-commandbar");
  if (buttons === null) {
    tabbar.append(toggle);
  } else {
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

/** Removes the switch, and the bar above the lists once no switch is left in it. */
function removeListSwitch(document: Document, { className }: ListSwitch): void {
  document.querySelector(`.${className}`)?.remove();
  const bar = document.querySelector(`.${BAR_CLASS}`);
  if (bar !== null && bar.childElementCount === 0) {
    bar.remove();
  }
}

/** Shows the switch on the lists, on or off. `null` removes it. Only touches the DOM on a change. */
function showListSwitch(
  document: Document,
  listSwitch: ListSwitch,
  state: ListSwitchState | null,
): void {
  if (state === null) {
    removeListSwitch(document, listSwitch);
    return;
  }
  const toggle =
    document.querySelector<HTMLButtonElement>(`.${listSwitch.className}`) ??
    createListSwitch(document, listSwitch);
  if (!placeInTabbar(document, toggle)) {
    placeAboveLists(document, toggle);
  }
  onToggleBySwitch.set(toggle, state.onToggle);
  showSwitchOn(toggle, state.isOn);
}

export type { ListSwitch, ListSwitchState };
export { showListSwitch };
