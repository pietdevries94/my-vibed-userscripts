import { AVATAR_SELECTOR, avatarName } from "./avatars.ts";
import {
  PIPELINE_STATUS_ICON_CLASS,
  createPipelineStatusIcon,
} from "../pipeline/pipeline-status-icon.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { Reviewer } from "./reviewers.ts";
import type { ShownStatus } from "../pipeline/pipeline-status-icon.ts";
import { findReviewerByLabel } from "./reviewers.ts";
import { parsePullRequestHref } from "./pull-request-link.ts";

const PULL_REQUEST_ROW_SELECTOR = 'a.bolt-table-row[href*="/pullrequest/"]';
const TITLE_LINE_SELECTOR = ".bolt-table-two-line-cell-item";

interface PullRequestRow {
  row: HTMLElement;
  pullRequest: PullRequestRef;
}

function findPullRequestRows(root: ParentNode, apiBasePath: string): PullRequestRow[] {
  const rows: PullRequestRow[] = [];
  for (const row of root.querySelectorAll<HTMLElement>(PULL_REQUEST_ROW_SELECTOR)) {
    const pullRequest = parsePullRequestHref(row.getAttribute("href") ?? "", apiBasePath);
    if (pullRequest) {
      rows.push({ pullRequest, row });
    }
  }
  return rows;
}

/**
 * Puts the status icon after the pull request title. While the status loads, or
 * when there is none, a grey circle holds its place, so the title line does not
 * shift. Safe to call repeatedly: it only touches the DOM when the row shows
 * something else. ADO reuses row elements for other pull requests, so the icon
 * records which one it belongs to.
 */
function showPipelineStatus(row: HTMLElement, pullRequestId: number, status: ShownStatus): void {
  const shownIcon = row.querySelector<SVGElement>(`.${PIPELINE_STATUS_ICON_CLASS}`);
  if (
    shownIcon?.dataset.status === status &&
    shownIcon.dataset.pullRequestId === String(pullRequestId)
  ) {
    return;
  }

  shownIcon?.remove();
  const title = row.querySelector(TITLE_LINE_SELECTOR)?.firstElementChild;
  title?.after(createPipelineStatusIcon(row.ownerDocument, status, pullRequestId));
}

const DRAFT_PILL_SELECTOR = ".repos-pr-list-draft-pill";
const ROW_ACTIONS_CELL_SELECTOR = ".bolt-table-cell-side-action";
const PUBLISHED_SINCE_CLASS = "fix-ado-published-since";

/** True when Azure DevOps shows its Draft pill on the row. */
function isDraftRow(row: HTMLElement): boolean {
  return row.querySelector(DRAFT_PILL_SELECTOR) !== null;
}

/** Adds the column for the publish time to the row's table, before the actions column. */
function addPublishedSinceColumn(row: HTMLElement): void {
  const columns = row.closest("table")?.querySelector(":scope > colgroup");
  if (!columns || columns.querySelector(`.${PUBLISHED_SINCE_CLASS}`)) {
    return;
  }
  const column = row.ownerDocument.createElement("col");
  column.className = PUBLISHED_SINCE_CLASS;
  const actionsColumn = columns.lastElementChild?.previousElementSibling;
  if (actionsColumn) {
    actionsColumn.before(column);
  } else {
    columns.append(column);
  }
}

/** The row's publish time cell, added before the actions cell when missing. Null without an actions cell. */
function publishedSinceCell(row: HTMLElement): Element | null {
  const shown = row.querySelector(`:scope > .${PUBLISHED_SINCE_CLASS}`);
  if (shown) {
    return shown;
  }
  const actionsCell = row.querySelector(`:scope > ${ROW_ACTIONS_CELL_SELECTOR}`);
  if (!actionsCell) {
    return null;
  }
  const cell = row.ownerDocument.createElement("td");
  cell.className = `${PUBLISHED_SINCE_CLASS} bolt-table-cell bolt-list-cell secondary-text`;
  actionsCell.before(cell);
  return cell;
}

/**
 * Shows "Published 3 minutes ago" in a cell before the row's actions. A draft row gets
 * `null` and an empty cell, so the columns stay aligned. Only touches the DOM on a change.
 */
function showPublishedSince(row: HTMLElement, text: string | null): void {
  const cell = publishedSinceCell(row);
  if (!cell) {
    return;
  }
  addPublishedSinceColumn(row);
  if (cell.textContent !== (text ?? "")) {
    cell.textContent = text ?? "";
  }
}

const REVIEWER_SELECTOR = ".pr-reviewer";

/**
 * Marks the required reviewers of a row. style.css outlines them and puts
 * them first. A reviewer is found by name in the label of its avatar.
 */
function markRequiredReviewers(row: HTMLElement, reviewers: Reviewer[]): void {
  for (const reviewerElement of row.querySelectorAll<HTMLElement>(REVIEWER_SELECTOR)) {
    const avatar = reviewerElement.querySelector(AVATAR_SELECTOR);
    const reviewer = avatar ? findReviewerByLabel(avatarName(avatar), reviewers) : null;
    reviewerElement.toggleAttribute("data-fix-ado-required", reviewer?.isRequired ?? false);
    reviewerElement.parentElement?.toggleAttribute("data-fix-ado-reviewers", true);
  }
}

export type { PullRequestRow };
export {
  findPullRequestRows,
  isDraftRow,
  markRequiredReviewers,
  showPipelineStatus,
  showPublishedSince,
};
