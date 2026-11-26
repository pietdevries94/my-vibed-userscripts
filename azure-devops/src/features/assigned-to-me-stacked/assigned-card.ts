// The "Assigned to me" card, one card per tab: the selected tab's card is Azure DevOps's own,
// the script builds the others as copies of it. Each card's title names its tab.
import { buildAssignedRow, copyOf } from "./assigned-row.ts";
import { ACTIVE_TAB_ID } from "./assigned-tabs.ts";
import type { AssignedPullRequest } from "./assigned-tabs.ts";
import type { RowContext } from "./assigned-row.ts";

const CARD_SELECTOR = ".repos-pr-section-card";
const TAB_SELECTOR = '.repos-pr-section-tabs [role="tab"]';
const TABLE_CONTAINER_SELECTOR = ".bolt-table-container";
const ROW_SELECTOR = 'a.bolt-table-row[href*="/pullrequest/"]';
/** Azure DevOps's card, with its other tabs hidden. */
const STACKED_CLASS = "fix-ado-assigned-stacked";
/** A card the script builds for one of the other tabs. */
const BUILT_CARD_CLASS = "fix-ado-assigned-card";
/** Azure DevOps's folded card while the script unfolds it for a moment. card-peek.ts adds it. */
const PEEKING_CLASS = "fix-ado-assigned-peeking";
const CARD_TITLE_SELECTOR = ".repos-pr-section-header-title > .text-ellipsis";
/** The tab's name and count after the card's title, as the tabs are hidden. */
const TAB_NAME_CLASS = "fix-ado-assigned-tab-name";

interface AssignedToMe {
  reviewerId: string;
  pullRequests: AssignedPullRequest[];
}

interface CardTab {
  id: string;
  isSelected: boolean;
  element: Element;
}

/** Azure DevOps's card, its tabs, and its list of the selected tab. */
interface AssignedCard {
  card: HTMLElement;
  tabs: CardTab[];
  table: HTMLElement;
}

/** A tab and the pull requests to list under it. */
interface TabList {
  tab: CardTab;
  pullRequests: AssignedPullRequest[];
}

function findAssignedCard(document: Document): AssignedCard | null {
  const card = document.querySelector(`#${ACTIVE_TAB_ID}`)?.closest<HTMLElement>(CARD_SELECTOR);
  const table = card?.querySelector<HTMLElement>(TABLE_CONTAINER_SELECTOR);
  if (!card || !table) {
    return null;
  }
  const tabs = [...card.querySelectorAll(TAB_SELECTOR)].map((tab) => ({
    element: tab,
    id: tab.id,
    isSelected: tab.getAttribute("aria-selected") === "true",
  }));
  return { card, table, tabs };
}

/**
 * An empty table like Azure DevOps's own, with the same columns and widths. Visible: Azure
 * DevOps marks its list invisible for a moment while it lays it out, as after unfolding.
 */
function createTable(adoTable: HTMLElement): HTMLElement | null {
  const container = copyOf(adoTable);
  container?.classList.remove("invisible");
  const table = container?.querySelector("table");
  table?.removeAttribute("aria-label");
  table?.removeAttribute("aria-rowcount");
  table?.querySelector("tbody")?.replaceChildren();
  return container;
}

/** A tab's name and count, as the card's title shows them. */
interface TabName {
  label: string;
  count: string;
}

function tabNameOf(tab: Element): TabName {
  return {
    count: tab.querySelector(".bolt-tab-badge")?.textContent ?? "",
    label: tab.querySelector(".bolt-tab-text")?.textContent ?? "",
  };
}

/** The count pill Azure DevOps puts after a card's title. */
function createCountPill(document: Document, count: string): HTMLElement {
  const pill = Object.assign(document.createElement("div"), {
    className: "margin-left-8 bolt-pill flex-row flex-center standard regular",
  });
  const content = Object.assign(document.createElement("div"), {
    className: "bolt-pill-content text-ellipsis",
    textContent: count,
  });
  content.setAttribute("role", "presentation");
  pill.append(content);
  return pill;
}

function createTabName(card: HTMLElement, { label, count }: TabName, key: string): HTMLElement {
  const name = Object.assign(card.ownerDocument.createElement("span"), {
    className: TAB_NAME_CLASS,
  });
  name.dataset.fixAdoShown = key;
  name.append(`· ${label}`, ...(count === "" ? [] : [createCountPill(card.ownerDocument, count)]));
  return name;
}

/**
 * "Assigned to me · Waiting for author", with the tab's count. The card keeps it, for when
 * Azure DevOps draws the title again without tabs, as it does for a folded card. Only
 * touches the DOM on a change.
 */
function showTabName(card: HTMLElement, tabName: TabName): void {
  const key = JSON.stringify(tabName);
  if (card.dataset.fixAdoTabName !== key) {
    card.dataset.fixAdoTabName = key;
  }
  const title = card.querySelector(CARD_TITLE_SELECTOR);
  const shown = card.querySelector<HTMLElement>(`.${TAB_NAME_CLASS}`);
  const isInPlace = title?.nextElementSibling === shown;
  if (shown?.dataset.fixAdoShown === key && isInPlace) {
    return;
  }
  shown?.remove();
  // Azure DevOps can draw its title again after the name, as after unfolding.
  title?.after(shown?.dataset.fixAdoShown === key ? shown : createTabName(card, tabName, key));
}

/** The tab name the card showed last, or null when it showed none. */
function shownTabName(card: HTMLElement): TabName | null {
  const key = card.dataset.fixAdoTabName;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- showTabName wrote it
  return key === undefined ? null : (JSON.parse(key) as TabName);
}

/** Names this tab after the card's title, with `count`, and leaves only it in the hidden tab bar. */
function showOnlyTab(card: HTMLElement, tabId: string, count: number): void {
  for (const tab of card.querySelectorAll(TAB_SELECTOR)) {
    if (tab.id === tabId) {
      tab.querySelector(".bolt-tab-badge .bolt-pill-content")?.replaceChildren(String(count));
      showTabName(card, tabNameOf(tab));
    } else {
      tab.remove();
    }
  }
}

function createRows(
  found: AssignedCard,
  pullRequests: AssignedPullRequest[],
  context: RowContext,
): HTMLElement[] {
  // Every card's rows have the same columns: with this tab empty, a row of another card will do.
  const template =
    found.table.querySelector<HTMLElement>(ROW_SELECTOR) ??
    found.card.ownerDocument.querySelector<HTMLElement>(
      `${CARD_SELECTOR}:not(.${BUILT_CARD_CLASS}) ${ROW_SELECTOR}`,
    );
  return pullRequests.flatMap((pullRequest, index) => {
    const row = template ? buildAssignedRow(template, pullRequest, context) : null;
    row?.classList.toggle("first-row", index === 0);
    row?.setAttribute("aria-rowindex", String(index + 1));
    return row ? [row] : [];
  });
}

/** Marks a copy of the card as the script's, without the ids that Azure DevOps's card has. Last, as the tabs go by id. */
function markAsBuilt(card: HTMLElement): void {
  card.classList.remove(STACKED_CLASS, PEEKING_CLASS);
  card.classList.add(BUILT_CARD_CLASS);
  for (const element of card.querySelectorAll("[id]")) {
    element.removeAttribute("id");
  }
}

/** A copy of Azure DevOps's card that lists one other tab's pull requests. */
function createCard(
  found: AssignedCard,
  { tab, pullRequests }: TabList,
  context: RowContext,
): HTMLElement | null {
  const card = copyOf(found.card);
  const table = createTable(found.table);
  if (card === null || table === null) {
    return null;
  }
  card.querySelector(TABLE_CONTAINER_SELECTOR)?.replaceWith(table);
  table.querySelector("tbody")?.append(...createRows(found, pullRequests, context));
  showOnlyTab(card, tab.id, pullRequests.length);
  markAsBuilt(card);
  return card;
}

export type { AssignedCard, AssignedToMe, CardTab, TabList };
export {
  BUILT_CARD_CLASS,
  CARD_SELECTOR,
  CARD_TITLE_SELECTOR,
  PEEKING_CLASS,
  STACKED_CLASS,
  TAB_NAME_CLASS,
  createCard,
  findAssignedCard,
  showTabName,
  shownTabName,
  tabNameOf,
};
