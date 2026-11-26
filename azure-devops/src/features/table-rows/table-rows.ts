// The pull request lists as a table, as design B of the inbox redesigns. Marks <html>, puts a
// header above each list and gives each row the cells Azure DevOps has no column for: the
// author's name, the id, the target and the work item. style.css lays the rows out from the mark.

import { avatarName } from "../../pull-requests/avatars.ts";

const TABLE_ATTRIBUTE = "data-fix-ado-table";
const HEAD_CLASS = "fix-ado-table-head";
const AUTHOR_CLASS = "fix-ado-table-author";
const ID_CLASS = "fix-ado-table-id";
const TARGET_CLASS = "fix-ado-table-target";
const BRANCH_CLASS = "fix-ado-table-branch";
const WORK_ITEM_CLASS = "fix-ado-table-work-item";
const WORK_ITEM_LABEL_CLASS = "fix-ado-linked-work-item";
const LIST_SELECTOR = "table.repos-pr-list";
const ROW_SELECTOR = ':scope > tbody > a.bolt-table-row[href*="/pullrequest/"]';
const LINE_UNDER_TITLE_SELECTOR = ".bolt-table-two-line-cell-item:nth-child(2) .secondary-text";

/** The header's columns, by the class style.css places them with, in the table's order. */
const COLUMNS = [
  ["pipeline", ""],
  ["title", "Pull request"],
  ["author", "Author"],
  ["id", "Id"],
  ["target", "Target"],
  ["work-item", "Work item"],
  ["reviewers", "Reviewers"],
  ["comments", "Comments"],
  ["age", "Age"],
] as const;

function createHead(document: Document): HTMLTableSectionElement {
  const head = document.createElement("thead");
  head.className = HEAD_CLASS;
  const row = document.createElement("tr");
  for (const [column, label] of COLUMNS) {
    const cell = document.createElement("th");
    cell.className = `${HEAD_CLASS}-${column}`;
    cell.textContent = label;
    row.append(cell);
  }
  head.append(row);
  return head;
}

function showHead(list: HTMLTableElement, isTable: boolean): void {
  const shown = list.querySelector(`:scope > .${HEAD_CLASS}`);
  if (!isTable) {
    shown?.remove();
    return;
  }
  const [body] = list.tBodies;
  if (shown === null && body !== undefined) {
    body.before(createHead(list.ownerDocument));
  }
}

/** The row's own cell with this class, added at the end of the row when missing. */
function cellOf(row: Element, className: string): HTMLTableCellElement {
  const shown = row.querySelector<HTMLTableCellElement>(`:scope > td.${className}`);
  if (shown !== null) {
    return shown;
  }
  const cell = row.ownerDocument.createElement("td");
  cell.className = className;
  row.append(cell);
  return cell;
}

function showText(element: Element, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

function showAuthor(row: Element): void {
  const avatar = row.querySelector('[aria-colindex="1"] .bolt-coin');
  const content = row.querySelector('[aria-colindex="1"] .bolt-table-cell-content');
  if (avatar === null || content === null) {
    return;
  }
  let name = content.querySelector(`:scope > .${AUTHOR_CLASS}`);
  if (name === null) {
    name = row.ownerDocument.createElement("span");
    name.className = AUTHOR_CLASS;
    content.append(name);
  }
  showText(name, avatarName(avatar));
}

function showId(row: Element): void {
  const id = /\/pullrequest\/(?<id>\d+)/u.exec(row.getAttribute("href") ?? "")?.groups?.id ?? "";
  showText(cellOf(row, ID_CLASS), `!${id}`);
}

/** "repository → branch", the branch in Azure DevOps's monospace. */
function showTarget(row: Element): void {
  const repository =
    row.querySelector(".secondary-text .padding-horizontal-4:not(.monospaced-xs)")?.textContent ??
    "";
  const branch = row.querySelector(".secondary-text .monospaced-xs")?.textContent ?? "";
  // A repository's own list names no repository: there the branch shows alone.
  const prefix = repository === "" ? "" : `${repository} → `;
  const cell = cellOf(row, TARGET_CLASS);
  const shownBranch = cell.querySelector(`.${BRANCH_CLASS}`);
  if (cell.textContent === `${prefix}${branch}` && shownBranch?.textContent === branch) {
    return;
  }
  const branchElement = Object.assign(row.ownerDocument.createElement("span"), {
    className: BRANCH_CLASS,
    textContent: branch,
  });
  cell.replaceChildren(...(prefix === "" ? [] : [prefix]), branchElement);
}

/** Moves the linked work item's label, which Linked work item keeps up to date, into its cell. */
function showWorkItem(row: Element): void {
  const cell = cellOf(row, WORK_ITEM_CLASS);
  const label = row.querySelector(`.${WORK_ITEM_LABEL_CLASS}`);
  if (label !== null && label.parentElement !== cell) {
    cell.append(label);
  }
  const isId = label?.textContent?.startsWith("#") ?? false;
  if (Object.hasOwn(cell.dataset, "fixAdoIsId") !== isId) {
    cell.toggleAttribute("data-fix-ado-is-id", isId);
  }
}

/** Takes the row's cells away, and puts the work item back on the line under the title. */
function removeCells(row: Element): void {
  const label = row.querySelector(`.${WORK_ITEM_CLASS} > .${WORK_ITEM_LABEL_CLASS}`);
  if (label !== null) {
    row.querySelector(LINE_UNDER_TITLE_SELECTOR)?.append(label);
  }
  for (const added of row.querySelectorAll(
    `.${AUTHOR_CLASS}, .${ID_CLASS}, .${TARGET_CLASS}, .${WORK_ITEM_CLASS}`,
  )) {
    added.remove();
  }
}

function showCells(row: Element): void {
  showAuthor(row);
  showId(row);
  showTarget(row);
  showWorkItem(row);
}

/** Shows the lists as a table, or as Azure DevOps's own. Only touches the DOM on a change. */
function showTableRows(document: Document, isTable: boolean): void {
  const root = document.documentElement;
  if (root.hasAttribute(TABLE_ATTRIBUTE) !== isTable) {
    root.toggleAttribute(TABLE_ATTRIBUTE, isTable);
  }
  for (const list of document.querySelectorAll<HTMLTableElement>(LIST_SELECTOR)) {
    showHead(list, isTable);
    for (const row of list.querySelectorAll(ROW_SELECTOR)) {
      (isTable ? showCells : removeCells)(row);
    }
  }
}

/** True while Windows 98 mode is on: it marks <html> when it starts, and lays the rows out itself. */
function isWindows98Mode(document: Document): boolean {
  return Object.hasOwn(document.documentElement.dataset, "fixAdoWin98");
}

export { isWindows98Mode, showTableRows };
