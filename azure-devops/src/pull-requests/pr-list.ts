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
const UPDATE_TIME_SELECTOR = "time.bolt-time-item";
const PUBLISHED_SINCE_CLASS = "fix-ado-published-since";
const TOO_LONG_AGO_CLASS = "fix-ado-published-since-too-long";

/** True when Azure DevOps shows its Draft pill on the row. */
function isDraftRow(row: HTMLElement): boolean {
  return row.querySelector(DRAFT_PILL_SELECTOR) !== null;
}

/** What the row shows under its update time. */
interface PublishedSince {
  text: string;
  isTooLongAgo: boolean;
}

/** The line under the update time, added when missing. Null without an update time. */
function publishedSinceLine(row: HTMLElement): Element | null {
  const shown = row.querySelector(`.${PUBLISHED_SINCE_CLASS}`);
  if (shown) {
    return shown;
  }
  const updateLine = row
    .querySelector(UPDATE_TIME_SELECTOR)
    ?.closest(".bolt-table-cell-content > *");
  if (!updateLine) {
    return null;
  }
  const line = row.ownerDocument.createElement("div");
  line.className = PUBLISHED_SINCE_CLASS;
  updateLine.after(line);
  return line;
}

/**
 * Shows "Published 3 minutes ago" under the row's update time, red when it is too long
 * ago. `null` removes it. Only touches the DOM on a change.
 */
function showPublishedSince(row: HTMLElement, shown: PublishedSince | null): void {
  if (shown === null) {
    row.querySelector(`.${PUBLISHED_SINCE_CLASS}`)?.remove();
    return;
  }
  const line = publishedSinceLine(row);
  if (!line) {
    return;
  }
  if (line.textContent !== shown.text) {
    line.textContent = shown.text;
  }
  if (line.classList.contains(TOO_LONG_AGO_CLASS) !== shown.isTooLongAgo) {
    line.classList.toggle(TOO_LONG_AGO_CLASS, shown.isTooLongAgo);
  }
}

const LINE_UNDER_TITLE_SELECTOR = `${TITLE_LINE_SELECTOR}:nth-child(2) .secondary-text`;
const LINKED_WORK_ITEM_CLASS = "fix-ado-linked-work-item";

/** What a row shows for its linked work items: an id or "Multiple work items", and a hover text. */
interface LinkedWorkItemLabel {
  text: string;
  tooltip: string | null;
}

/** The label at the end of the line under the title, added when missing. Null without that line. */
function linkedWorkItemElement(row: HTMLElement): HTMLElement | null {
  const shown = row.querySelector<HTMLElement>(`.${LINKED_WORK_ITEM_CLASS}`);
  const lineUnderTitle = row.querySelector(LINE_UNDER_TITLE_SELECTOR);
  if (shown !== null || lineUnderTitle === null) {
    return shown;
  }
  const label = row.ownerDocument.createElement("span");
  label.className = LINKED_WORK_ITEM_CLASS;
  lineUnderTitle.append(label);
  return label;
}

/** Sets the element's hover text, or removes it for null. Only touches the DOM on a change. */
function showTooltip(element: HTMLElement, tooltip: string | null): void {
  if (tooltip === null) {
    element.removeAttribute("title");
  } else if (element.getAttribute("title") !== tooltip) {
    element.setAttribute("title", tooltip);
  }
}

/**
 * Shows the linked work item at the end of the line under the title, such as "#123"
 * with its title on hover. `null` removes it. Only touches the DOM on a change.
 */
function showLinkedWorkItem(row: HTMLElement, shown: LinkedWorkItemLabel | null): void {
  if (shown === null) {
    row.querySelector(`.${LINKED_WORK_ITEM_CLASS}`)?.remove();
    return;
  }
  const label = linkedWorkItemElement(row);
  if (label === null) {
    return;
  }
  if (label.textContent !== shown.text) {
    label.textContent = shown.text;
  }
  showTooltip(label, shown.tooltip);
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

export type { LinkedWorkItemLabel, PublishedSince, PullRequestRow };
export {
  findPullRequestRows,
  isDraftRow,
  markRequiredReviewers,
  showLinkedWorkItem,
  showPipelineStatus,
  showTooltip,
  showPublishedSince,
};
