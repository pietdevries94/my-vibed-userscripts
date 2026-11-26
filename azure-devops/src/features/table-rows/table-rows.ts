// The pull request lists as a table, as design B of the inbox redesigns. Marks <html>, puts a
// header above each list and gives each row the cells Azure DevOps has no column for: the id, the
// repository, the target branch and the work item. The author shows as an avatar, with the name
// in Azure DevOps's tooltip, and table-age.ts shows the ages. style.css lays the rows out from the
// mark.

import { removeAge, showAge, showAgeHead } from "./table-age.ts";
import type { AgeTimes } from "./table-age.ts";
import { avatarName } from "../../pull-requests/avatars.ts";
import { showTooltip } from "../../core/tooltip.ts";

const TABLE_ATTRIBUTE = "data-fix-ado-table";
const HEAD_CLASS = "fix-ado-table-head";
/** On the "Created by me" list: it lists only your own pull requests, so it has no Author column. */
const CREATED_BY_ME_ATTRIBUTE = "data-fix-ado-created-by-me";
const CREATED_BY_ME_TITLE = "Created by me";
const CARD_SELECTOR = ".repos-pr-section-card";
const CARD_TITLE_SELECTOR = ".repos-pr-section-header-title > .text-ellipsis";
const AUTHOR_CELL_SELECTOR = '[aria-colindex="1"]';
const ID_CLASS = "fix-ado-table-id";
const REPOSITORY_CLASS = "fix-ado-table-repository";
const HAS_REPOSITORY_ATTRIBUTE = "data-fix-ado-has-repository";
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
  ["repository", "Repository"],
  ["target", "Target"],
  ["work-item", "Work item"],
  ["reviewers", "Reviewers"],
  ["comments", "Comments"],
  ["age", "Age"],
] as const;

function createHeadCell(document: Document, column: string, label: string): HTMLElement {
  const cell = document.createElement("th");
  cell.className = `${HEAD_CLASS}-${column}`;
  cell.textContent = label;
  if (column === "age") {
    showAgeHead(cell);
  }
  return cell;
}

function createHead(document: Document): HTMLTableSectionElement {
  const head = document.createElement("thead");
  head.className = HEAD_CLASS;
  const row = document.createElement("tr");
  row.append(...COLUMNS.map(([column, label]) => createHeadCell(document, column, label)));
  head.append(row);
  return head;
}

function isCreatedByMe(list: HTMLTableElement): boolean {
  const title = list.closest(CARD_SELECTOR)?.querySelector(CARD_TITLE_SELECTOR);
  return title?.textContent?.trim() === CREATED_BY_ME_TITLE;
}

/** Marks a list where a row names its repository: only there the table has a Repository column.
 *  A mark from the script, as CSS can miss a cell that gets its text after it was added. */
function markHasRepository(list: HTMLTableElement, isTable: boolean): void {
  const hasRepository =
    isTable &&
    [...list.querySelectorAll(`:scope > tbody > a > .${REPOSITORY_CLASS}`)].some(
      (cell) => cell.textContent !== "",
    );
  if (list.hasAttribute(HAS_REPOSITORY_ATTRIBUTE) !== hasRepository) {
    list.toggleAttribute(HAS_REPOSITORY_ATTRIBUTE, hasRepository);
  }
}

function markCreatedByMe(list: HTMLTableElement, isTable: boolean): void {
  const isMarked = isTable && isCreatedByMe(list);
  if (list.hasAttribute(CREATED_BY_ME_ATTRIBUTE) !== isMarked) {
    list.toggleAttribute(CREATED_BY_ME_ATTRIBUTE, isMarked);
  }
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

/** The author's name as the tooltip of the author's cell, which shows only the avatar. */
function showAuthor(row: Element): void {
  const cell = row.querySelector(`:scope > ${AUTHOR_CELL_SELECTOR}`);
  const avatar = cell?.querySelector(".bolt-coin");
  if (!cell || !avatar) {
    return;
  }
  const name = avatarName(avatar);
  showTooltip(cell, name);
}

function showId(row: Element): void {
  const id = /\/pullrequest\/(?<id>\d+)/u.exec(row.getAttribute("href") ?? "")?.groups?.id ?? "";
  showText(cellOf(row, ID_CLASS), `!${id}`);
}

/** The repository's name. Only the inbox names it; elsewhere the cell stays empty, and
 *  style.css leaves out the column. */
function showRepository(row: Element): void {
  const repository =
    row.querySelector(".secondary-text .padding-horizontal-4:not(.monospaced-xs)")?.textContent ??
    "";
  const cell = cellOf(row, REPOSITORY_CLASS);
  showText(cell, repository);
  showTooltip(cell, repository);
}

/** The target branch, in Azure DevOps's monospace. */
function showTarget(row: Element): void {
  const branch = row.querySelector(".secondary-text .monospaced-xs")?.textContent ?? "";
  const cell = cellOf(row, TARGET_CLASS);
  showTooltip(cell, branch);
  const shownBranch = cell.querySelector(`:scope > .${BRANCH_CLASS}`);
  if (shownBranch !== null && cell.childNodes.length === 1) {
    showText(shownBranch, branch);
    return;
  }
  cell.replaceChildren(
    Object.assign(row.ownerDocument.createElement("span"), {
      className: BRANCH_CLASS,
      textContent: branch,
    }),
  );
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
  const author = row.querySelector(`:scope > ${AUTHOR_CELL_SELECTOR}`);
  if (author !== null) {
    showTooltip(author, null);
  }
  removeAge(row);
  for (const added of row.querySelectorAll(
    `.${ID_CLASS}, .${REPOSITORY_CLASS}, .${TARGET_CLASS}, .${WORK_ITEM_CLASS}`,
  )) {
    added.remove();
  }
}

function showCells(row: Element, times: AgeTimes): void {
  showAuthor(row);
  showId(row);
  showRepository(row);
  showTarget(row);
  showWorkItem(row);
  showAge(row, times);
}

/** Shows the lists as a table, or as Azure DevOps's own. Only touches the DOM on a change. */
function showTableRows(document: Document, isTable: boolean, times: AgeTimes): void {
  const root = document.documentElement;
  if (root.hasAttribute(TABLE_ATTRIBUTE) !== isTable) {
    root.toggleAttribute(TABLE_ATTRIBUTE, isTable);
  }
  for (const list of document.querySelectorAll<HTMLTableElement>(LIST_SELECTOR)) {
    showList(list, isTable, times);
  }
}

/** One list as a table, or as Azure DevOps's own. */
function showList(list: HTMLTableElement, isTable: boolean, times: AgeTimes): void {
  showHead(list, isTable);
  markCreatedByMe(list, isTable);
  for (const row of list.querySelectorAll(ROW_SELECTOR)) {
    if (isTable) {
      showCells(row, times);
    } else {
      removeCells(row);
    }
  }
  markHasRepository(list, isTable);
}

/** True while Windows 98 mode is on: it marks <html> when it starts, and lays the rows out itself. */
function isWindows98Mode(document: Document): boolean {
  return Object.hasOwn(document.documentElement.dataset, "fixAdoWin98");
}

export { isWindows98Mode, showTableRows };
