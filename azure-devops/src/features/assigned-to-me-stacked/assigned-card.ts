// The "Assigned to me" card, one card per tab: the selected tab's card is Azure DevOps's own,
// the script builds the others as copies of it, each showing only its own tab.
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

interface AssignedToMe {
  reviewerId: string;
  pullRequests: AssignedPullRequest[];
}

interface CardTab {
  id: string;
  isSelected: boolean;
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
    id: tab.id,
    isSelected: tab.getAttribute("aria-selected") === "true",
  }));
  return { card, table, tabs };
}

/** An empty table like Azure DevOps's own, with the same columns and widths. */
function createTable(adoTable: HTMLElement): HTMLElement | null {
  const container = copyOf(adoTable);
  const table = container?.querySelector("table");
  table?.removeAttribute("aria-label");
  table?.removeAttribute("aria-rowcount");
  table?.querySelector("tbody")?.replaceChildren();
  return container;
}

/** Leaves only this tab in the card's tab bar, selected, with `count` in its pill. */
function showOnlyTab(card: HTMLElement, tabId: string, count: number): void {
  for (const tab of card.querySelectorAll(TAB_SELECTOR)) {
    if (tab.id === tabId) {
      tab.setAttribute("aria-selected", "true");
      tab.classList.add("selected");
      tab.querySelector(".bolt-tab-badge .bolt-pill-content")?.replaceChildren(String(count));
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
  const template = found.table.querySelector<HTMLElement>(ROW_SELECTOR);
  return pullRequests.flatMap((pullRequest, index) => {
    const row = template ? buildAssignedRow(template, pullRequest, context) : null;
    row?.classList.toggle("first-row", index === 0);
    row?.setAttribute("aria-rowindex", String(index + 1));
    return row ? [row] : [];
  });
}

/** Marks a copy of the card as the script's, without the ids that Azure DevOps's card has. Last, as the tabs go by id. */
function markAsBuilt(card: HTMLElement): void {
  card.classList.remove(STACKED_CLASS);
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
export { BUILT_CARD_CLASS, STACKED_CLASS, createCard, findAssignedCard };
