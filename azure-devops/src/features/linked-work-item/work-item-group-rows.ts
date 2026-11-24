import type { WorkItemGroup } from "./work-item-groups.ts";
import { showTooltip } from "../../pull-requests/pr-list.ts";

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

function createGroupTitle(document: Document, href: string | null, label: string): HTMLElement {
  const element = document.createElement(href === null ? "span" : "a");
  if (href !== null) {
    element.setAttribute("href", href);
  }
  element.textContent = label;
  return element;
}

/** The group's title: a link to its work item, or plain text. Only touches the DOM on a change. */
function showGroupTitle(
  row: HTMLTableRowElement,
  basePath: string,
  { label, title, workItemId }: WorkItemGroup<HTMLElement>,
): void {
  const [cell] = row.cells;
  if (cell === undefined) {
    return;
  }
  const href = workItemHref(basePath, workItemId);
  let shown = cell.querySelector<HTMLElement>(":scope > *");
  if (shown === null || shown.getAttribute("href") !== href || shown.textContent !== label) {
    shown = createGroupTitle(row.ownerDocument, href, label);
    cell.replaceChildren(shown);
  }
  showTooltip(shown, title);
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

export { showWorkItemGroups };
