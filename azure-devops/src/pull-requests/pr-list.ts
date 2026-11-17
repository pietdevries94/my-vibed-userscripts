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
export { findPullRequestRows, markRequiredReviewers, showPipelineStatus };
