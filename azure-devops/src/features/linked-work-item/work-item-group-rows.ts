import type { LinkedWorkItems } from "./linked-work-item.ts";
import type { WorkItemGroup } from "./work-item-groups.ts";

const GROUP_ROW_CLASS = "fix-ado-work-item-group";
const PULL_REQUEST_ROW_SELECTOR = ':scope > a.bolt-table-row[href*="/pullrequest/"]';

/** Moves a node inside the list. `moveBefore` keeps focus in a row; a new node is inserted. */
function placeBefore(list: HTMLElement, node: Element, before: ChildNode | null): void {
  if (node.parentNode === list) {
    list.moveBefore(node, before);
  } else if (before === null) {
    list.append(node);
  } else {
    before.before(node);
  }
}

/** Puts the nodes in this order where the list's rows are. Touches nothing when they already are. */
function placeInOrder(list: HTMLElement, ordered: Element[], shown: Element[]): void {
  const isInOrder =
    ordered.length === shown.length && ordered.every((node, index) => node === shown[index]);
  if (isInOrder) {
    return;
  }
  // After the rows come Azure DevOps's spacer rows, which stay last.
  const after = shown.at(-1)?.nextSibling ?? null;
  for (const node of ordered) {
    placeBefore(list, node, after);
  }
}

function createGroupRow(list: HTMLElement, key: string): HTMLTableRowElement {
  const { ownerDocument } = list;
  const row = ownerDocument.createElement("tr");
  row.className = GROUP_ROW_CLASS;
  row.dataset.fixAdoWorkItemGroup = key;
  const cell = ownerDocument.createElement("td");
  cell.colSpan = list.closest("table")?.querySelectorAll("col").length ?? 1;
  row.append(cell);
  return row;
}

function groupRowFor(list: HTMLElement, key: string): HTMLTableRowElement {
  const shown = [
    ...list.querySelectorAll<HTMLTableRowElement>(`:scope > .${GROUP_ROW_CLASS}`),
  ].find((row) => row.dataset.fixAdoWorkItemGroup === key);
  return shown ?? createGroupRow(list, key);
}

const workItemHref = (basePath: string, workItemId: number | null): string | null =>
  workItemId === null ? null : `${basePath}/_workitems/edit/${workItemId}`;

/** "#123" as a link to the work item, then its title; or plain text for the other groups. */
function createGroupTitle(
  document: Document,
  href: string | null,
  { label, title }: WorkItemGroup<HTMLElement>,
): (Node | string)[] {
  if (href === null) {
    return [Object.assign(document.createElement("span"), { textContent: label })];
  }
  const link = Object.assign(document.createElement("a"), { textContent: label });
  link.setAttribute("href", href);
  link.target = "_blank";
  link.rel = "noopener";
  if (title === null) {
    return [link];
  }
  const titleText = Object.assign(document.createElement("span"), {
    className: "fix-ado-work-item-group-title",
    textContent: title,
  });
  return [link, " ", titleText];
}

/** The group's title row. Only touches the DOM on a change. */
function showGroupTitle(
  row: HTMLTableRowElement,
  basePath: string,
  group: WorkItemGroup<HTMLElement>,
): void {
  const [cell] = row.cells;
  const href = workItemHref(basePath, group.workItemId);
  const shown = JSON.stringify([href, group.label, group.title]);
  if (cell === undefined || row.dataset.fixAdoShownTitle === shown) {
    return;
  }
  cell.replaceChildren(...createGroupTitle(row.ownerDocument, href, group));
  row.dataset.fixAdoShownTitle = shown;
}

const rowIndex = (row: Element): number => Number(row.getAttribute("aria-rowindex"));

function orderedNodes(
  list: HTMLElement,
  basePath: string,
  groups: WorkItemGroup<HTMLElement>[] | null,
): Element[] {
  if (groups === null) {
    return [...list.querySelectorAll(PULL_REQUEST_ROW_SELECTOR)].toSorted(
      (first, second) => rowIndex(first) - rowIndex(second),
    );
  }
  return groups.flatMap((group) => {
    const groupRow = groupRowFor(list, group.key);
    showGroupTitle(groupRow, basePath, group);
    return [groupRow, ...group.rows];
  });
}

/**
 * Shows the pull requests of one list (a `tbody`) in groups by work item, each under a
 * row with its title. `null` takes the groups away and puts the rows back in Azure
 * DevOps's order. Only touches the DOM on a change.
 */
function showWorkItemGroups(
  list: HTMLElement,
  basePath: string,
  groups: WorkItemGroup<HTMLElement>[] | null,
): void {
  const shownGroupRows = [...list.querySelectorAll(`:scope > .${GROUP_ROW_CLASS}`)];
  if (groups === null && shownGroupRows.length === 0) {
    // Never grouped: Azure DevOps's own order stays as it is.
    return;
  }
  const managed = new Set([...shownGroupRows, ...list.querySelectorAll(PULL_REQUEST_ROW_SELECTOR)]);
  const shown = [...list.children].filter((child) => managed.has(child));
  const ordered = orderedNodes(list, basePath, groups);
  const kept = new Set(ordered);
  for (const groupRow of shownGroupRows.filter((row) => !kept.has(row))) {
    groupRow.remove();
  }
  placeInOrder(
    list,
    ordered,
    shown.filter((node) => node.isConnected),
  );
}

const LOADING_ATTRIBUTE = "data-fix-ado-groups-loading";

/**
 * Marks the list's table, and tells screen readers it is busy, while its groups are on their
 * way: until then the rows show ungrouped. Pull requests as a table shows a skeleton instead.
 */
function showGroupsLoading(list: HTMLElement, isLoading: boolean): void {
  const table = list.closest("table");
  if (table === null || table.hasAttribute(LOADING_ATTRIBUTE) === isLoading) {
    return;
  }
  table.toggleAttribute(LOADING_ATTRIBUTE, isLoading);
  if (isLoading) {
    table.setAttribute("aria-busy", "true");
  } else {
    table.removeAttribute("aria-busy");
  }
}

// A colour per work item, so the pull requests of one work item stand out together: a bar at
// the front of each row that shares its work item with another row, and in a grouped list of
// every row of a work item's group and its group row. style.css draws the bar from the hue.

const HUE_ATTRIBUTE = "data-fix-ado-work-item-hue";
const HUE_PROPERTY = "--fix-ado-work-item-hue";
const FULL_TURN = 360;
/** The hue of Azure DevOps's blue, of its links and its marks. The work items' hues dodge it. */
const BLUE_HUE = 250;
const GROUP_ROW_SELECTOR = ":scope > tr.fix-ado-work-item-group";

/** A list's rows with their linked work items, and whether it shows them grouped. */
interface ColoredList {
  list: HTMLElement;
  rows: { row: HTMLElement; linked: LinkedWorkItems | null }[];
  isGrouped: boolean;
}

/** Gives the element a hue, or takes it away for null. Only writes on a change. */
function showHue(element: HTMLElement, hue: number | null): void {
  const shown = hue === null ? null : String(hue);
  if (element.getAttribute(HUE_ATTRIBUTE) === shown) {
    return;
  }
  if (shown === null) {
    element.removeAttribute(HUE_ATTRIBUTE);
    element.style.removeProperty(HUE_PROPERTY);
  } else {
    element.setAttribute(HUE_ATTRIBUTE, shown);
    element.style.setProperty(HUE_PROPERTY, shown);
  }
}

/** The row's one work item, or null for none, several or not fetched yet. */
const singleWorkItem = (linked: LinkedWorkItems | null): number | null =>
  linked?.ids.length === 1 ? (linked.ids[0] ?? null) : null;

/** The work items that get a colour in a list: grouped, every one with its own group; not
 *  grouped, those that more than one row has. */
function coloredWorkItems({ rows, isGrouped }: ColoredList): Set<number> {
  const counts = new Map<number, number>();
  for (const { linked } of rows) {
    const id = singleWorkItem(linked);
    if (id !== null) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => isGrouped || count > 1).map(([id]) => id));
}

/**
 * A hue for each work item, spread evenly around the colour circle with Azure DevOps's blue as
 * one of the places, in the order of their ids, so the colours on a page are as far apart as they
 * can be, from each other and from the blue. The same work items always get the same hues.
 */
function workItemHues(workItemIds: Iterable<number>): Map<number, number> {
  const ids = [...new Set(workItemIds)].toSorted((first, second) => first - second);
  return new Map(
    ids.map((id, index) => [
      id,
      Math.floor(BLUE_HUE + ((index + 1) * FULL_TURN) / (ids.length + 1)) % FULL_TURN,
    ]),
  );
}

function showListColors(
  { list, rows, isGrouped }: ColoredList,
  colored: Set<number>,
  hues: Map<number, number>,
): void {
  const hueOf = (id: number | null): number | null =>
    id !== null && colored.has(id) ? (hues.get(id) ?? null) : null;
  for (const { row, linked } of rows) {
    showHue(row, hueOf(singleWorkItem(linked)));
  }
  for (const groupRow of list.querySelectorAll<HTMLElement>(GROUP_ROW_SELECTOR)) {
    const id = Number(groupRow.dataset.fixAdoWorkItemGroup);
    showHue(groupRow, isGrouped && Number.isInteger(id) ? hueOf(id) : null);
  }
}

/**
 * Colours the page's lists by work item, with hues that dodge each other across the page.
 * Grouped: every row with one work item, and each work item's group row. Not grouped: the rows
 * whose work item another row in the list has too.
 */
function showWorkItemColors(lists: ColoredList[]): void {
  const colored = lists.map((list) => coloredWorkItems(list));
  const hues = workItemHues(colored.flatMap((ids) => [...ids]));
  for (const [index, list] of lists.entries()) {
    showListColors(list, colored[index] ?? new Set(), hues);
  }
}

export type { ColoredList };
export { showGroupsLoading, showWorkItemColors, showWorkItemGroups, workItemHues };
