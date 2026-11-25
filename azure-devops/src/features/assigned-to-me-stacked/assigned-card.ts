// The "Assigned to me" card with its tabs under each other: the selected tab's list is
// Azure DevOps's own, the script builds the others. Each list gets its tab's name as a title.
import { buildAssignedRow, copyOf } from "./assigned-row.ts";
import { ACTIVE_TAB_ID } from "./assigned-tabs.ts";
import type { AssignedPullRequest } from "./assigned-tabs.ts";
import type { RowContext } from "./assigned-row.ts";

const CARD_SELECTOR = ".repos-pr-section-card";
const TAB_SELECTOR = '.repos-pr-section-tabs [role="tab"]';
const TABLE_CONTAINER_SELECTOR = ".bolt-table-container";
const ROW_SELECTOR = 'a.bolt-table-row[href*="/pullrequest/"]';
const STACKED_CLASS = "fix-ado-assigned-stacked";
const TITLE_CLASS = "fix-ado-assigned-title";
const LIST_CLASS = "fix-ado-assigned-list";

interface AssignedToMe {
  reviewerId: string;
  pullRequests: AssignedPullRequest[];
}

interface CardTab {
  id: string;
  label: string;
  /** Azure DevOps's count pill, copied into the list's title. */
  badge: Element | null;
  isSelected: boolean;
}

/** The card's tabs, and Azure DevOps's own list of the selected one. */
interface AssignedCard {
  card: HTMLElement;
  tabs: CardTab[];
  table: HTMLElement;
}

function findAssignedCard(document: Document): AssignedCard | null {
  const card = document.querySelector(`#${ACTIVE_TAB_ID}`)?.closest<HTMLElement>(CARD_SELECTOR);
  const table = [...(card?.querySelectorAll<HTMLElement>(TABLE_CONTAINER_SELECTOR) ?? [])].find(
    (container) => !container.closest(`.${LIST_CLASS}`),
  );
  if (!card || table === undefined) {
    return null;
  }
  const tabs = [...card.querySelectorAll(TAB_SELECTOR)].map((tab) => ({
    badge: tab.querySelector(".bolt-tab-badge"),
    id: tab.id,
    isSelected: tab.getAttribute("aria-selected") === "true",
    label: tab.querySelector(".bolt-tab-text")?.textContent ?? "",
  }));
  return { card, table, tabs };
}

/** "Waiting for author" with the count pill of its tab, showing `count`. */
function createTitle(document: Document, tab: CardTab, count: number | null): HTMLElement {
  const title = Object.assign(document.createElement("div"), { className: TITLE_CLASS });
  title.setAttribute("role", "heading");
  title.setAttribute("aria-level", "2");
  title.dataset.fixAdoTab = tab.id;
  const badge = tab.badge ? copyOf(tab.badge) : null;
  if (count !== null && badge) {
    badge.querySelector(".bolt-pill-content")?.replaceChildren(String(count));
  }
  title.append(tab.label, ...(badge ? [" ", badge] : []));
  return title;
}

/** An empty table like Azure DevOps's own, with the same columns and widths. */
function createTable(adoTable: HTMLElement): HTMLElement {
  const container = Object.assign(adoTable.ownerDocument.createElement("div"), {
    className: adoTable.className,
  });
  const adoTableElement = adoTable.querySelector("table");
  const table = adoTableElement ? copyOf(adoTableElement) : null;
  if (table) {
    table.removeAttribute("aria-label");
    table.removeAttribute("aria-rowcount");
    table.querySelector("tbody")?.replaceChildren();
    container.append(table);
  }
  return container;
}

/** A tab's title and the pull requests to list under it. */
interface TabList {
  tab: CardTab;
  pullRequests: AssignedPullRequest[];
}

function createList(
  found: AssignedCard,
  { tab, pullRequests }: TabList,
  context: RowContext,
): HTMLElement {
  const { ownerDocument } = found.card;
  const list = Object.assign(ownerDocument.createElement("div"), { className: LIST_CLASS });
  const table = createTable(found.table);
  const template = found.table.querySelector<HTMLElement>(ROW_SELECTOR);
  const rows = pullRequests.flatMap((pullRequest, index) => {
    const row = template ? buildAssignedRow(template, pullRequest, context) : null;
    row?.classList.toggle("first-row", index === 0);
    row?.setAttribute("aria-rowindex", String(index + 1));
    return row ? [row] : [];
  });
  table.querySelector("tbody")?.append(...rows);
  list.append(createTitle(ownerDocument, tab, pullRequests.length), table);
  return list;
}

export type { AssignedCard, AssignedToMe, CardTab, TabList };
export {
  CARD_SELECTOR,
  LIST_CLASS,
  STACKED_CLASS,
  TITLE_CLASS,
  createList,
  createTitle,
  findAssignedCard,
};
