import type { SettingsSection } from "./feature.ts";
import type { View } from "./settings-panel-pane.ts";
import { element } from "./settings-panel-markup.ts";

const SEARCH_TEXT = "Search settings";
const WHATS_NEW = "What’s new";

interface NavOptions {
  document: Document;
  /** The panel's title, the side bar's heading. */
  title: HTMLElement;
  sections: SettingsSection[];
  /** How many features have a change the owner has not seen: What's new lists them. */
  unseenCount: number;
  /** Called on a pick in the side bar, and on every edit of the search. */
  onChange: () => void;
}

interface Nav {
  element: HTMLElement;
  /** The side bar's pick, or What's new when there are unseen changes. */
  view: () => View;
  /** The search in lower case, without spaces around it. Empty when there is none. */
  query: () => string;
}

interface NavItem {
  view: View;
  element: HTMLButtonElement;
}

/** A search field whose label only screen readers read: its placeholder shows the same words. */
function searchField(document: Document): { search: HTMLElement; field: HTMLInputElement } {
  const search = element(document, "search", { className: "fix-ado-settings-search" });
  const label = element(document, "label", { className: "fix-ado-settings-search-label" });
  const field = element(document, "input", { className: "fix-ado-settings-search-field" });
  Object.assign(field, {
    autocomplete: "off",
    placeholder: SEARCH_TEXT,
    spellcheck: false,
    type: "search",
  });
  field.setAttribute("autocapitalize", "none");
  field.setAttribute("autocorrect", "off");
  label.append(
    element(document, "span", { className: "fix-ado-settings-visually-hidden", text: SEARCH_TEXT }),
    field,
  );
  search.append(label);
  return { field, search };
}

function navButton(document: Document, name: string, count: number): HTMLButtonElement {
  const item = element(document, "button", { className: "fix-ado-settings-nav-item" });
  item.type = "button";
  item.append(element(document, "span", { className: "fix-ado-settings-nav-name", text: name }));
  if (count > 0) {
    item.append(
      element(document, "span", { className: "fix-ado-settings-nav-count", text: String(count) }),
    );
  }
  return item;
}

/** What's new first while there are unseen changes, then an entry per section. */
function navItems({ document, sections, unseenCount }: NavOptions): NavItem[] {
  const items: NavItem[] = sections.map((section, index) => ({
    element: navButton(document, section.name, 0),
    view: index,
  }));
  if (unseenCount > 0) {
    items.unshift({ element: navButton(document, WHATS_NEW, unseenCount), view: "whats-new" });
  }
  return items;
}

/** Marks the picked entry current, and none while a search shows. */
function markCurrent(items: NavItem[], view: View, query: string): void {
  for (const item of items) {
    if (query === "" && item.view === view) {
      item.element.setAttribute("aria-current", "page");
    } else {
      item.element.removeAttribute("aria-current");
    }
  }
}

/** The side bar element, with the title, search and entries in it. */
function navElement(options: NavOptions, search: HTMLElement, items: NavItem[]): HTMLElement {
  const { document } = options;
  const list = element(document, "div", { className: "fix-ado-settings-nav-items" });
  list.append(...items.map((item) => item.element));
  const nav = element(document, "nav", { className: "fix-ado-settings-nav" });
  nav.setAttribute("aria-label", "Settings sections");
  nav.append(options.title, search, list);
  return nav;
}

/** The side bar: the title, search and an entry per section. */
function createNav(options: NavOptions): Nav {
  const { search, field } = searchField(options.document);
  const items = navItems(options);
  const state = { view: items[0]?.view ?? 0 };
  const query = (): string => field.value.trim().toLowerCase();
  const show = (): void => {
    markCurrent(items, state.view, query());
    options.onChange();
  };
  for (const item of items) {
    item.element.addEventListener("click", () => {
      state.view = item.view;
      field.value = "";
      show();
    });
  }
  field.addEventListener("input", show);
  markCurrent(items, state.view, "");
  return { element: navElement(options, search, items), query, view: () => state.view };
}

export { createNav };
