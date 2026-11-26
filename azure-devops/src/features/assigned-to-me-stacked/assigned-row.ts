// A pull request row the script builds, as a copy of one of Azure DevOps's own rows in the
// same card, so it keeps the site's markup and wording ("requested … into", "Created").
import type { AssignedPullRequest, Person } from "./assigned-tabs.ts";
import type { Reviewer } from "../../pull-requests/reviewers.ts";
import { avatarName } from "../../pull-requests/avatars.ts";
import { relativeTime } from "./relative-time.ts";

const AUTHOR_AVATAR_SELECTOR = '[aria-colindex="1"] .bolt-coin';
const TITLE_SELECTOR = ".bolt-table-two-line-cell-item .body-l";
/** The pills after a title: draft, merge conflicts, and that I am a required reviewer. */
const TITLE_PILL_SELECTOR = ".bolt-table-two-line-cell-item .bolt-pill";
const DRAFT_PILL_SELECTOR = ".repos-pr-list-draft-pill";
const CONFLICTS_PILL_SELECTOR = ".repos-pr-list-conflicts-pill";
const REQUIRED_PILL_SELECTOR = ".repos-pr-list-required-pill";
const CONFLICTS_MERGE_STATUS = "conflicts";
const SUBTITLE_SELECTOR = ".bolt-table-two-line-cell-item .secondary-text > span";
const BRANCH_SELECTOR = ".monospaced-xs";
/** The inbox names the repository before the branch. */
const REPOSITORY_SELECTOR = ":scope > .padding-horizontal-4:not(.monospaced-xs)";
const REVIEWER_SELECTOR = ".pr-reviewer";
const REVIEWERS_CELL_SELECTOR = '[aria-colindex="3"] .bolt-table-cell-content';
/** The avatars in the reviewers cell of a site row with reviewers. */
const REVIEWER_GROUP_SELECTOR = `a.bolt-table-row:not(.fix-ado-assigned-card *) ${REVIEWERS_CELL_SELECTOR} > :has(> ${REVIEWER_SELECTOR})`;
/** The icon on a reviewer's avatar, in its wrapper. */
const VOTE_ICON_SELECTOR = ".fluent-icons-enabled:has(> .repos-pr-reviewer-vote)";
const APPROVED_VOTE = 10;
const APPROVED_WITH_SUGGESTIONS_VOTE = 5;
const WAITING_FOR_AUTHOR_VOTE = -5;
const REJECTED_VOTE = -10;
/** The site's class and icon for each vote. Approved with suggestions shows as approved. */
const VOTE_ICONS = new Map([
  [APPROVED_VOTE, ["approved", "ms-Icon--CompletedSolid"]],
  [APPROVED_WITH_SUGGESTIONS_VOTE, ["approved", "ms-Icon--CompletedSolid"]],
  [WAITING_FOR_AUTHOR_VOTE, ["waiting", "ms-Icon--AwayStatus"]],
  [REJECTED_VOTE, ["rejected", "ms-Icon--StatusErrorFull"]],
]);
const COMMENTS_CELL_SELECTOR = '[aria-colindex="4"] .bolt-table-cell-content';
const ROW_MENU_SELECTOR = ".bolt-table-cell-content-reveal";
/** What other features add to a row. They add it again to the built row. */
const SCRIPT_MARK_SELECTOR = '[class*="fix-ado-"]';
const BRANCH_PREFIX = /^refs\/heads\//u;
const MAX_SHOWN_REVIEWERS = 3;

interface RowContext {
  basePath: string;
  now: number;
  /** My id: a pill says when I am a required reviewer. */
  reviewerId: string;
}

const avatarHref = (person: Person | undefined): string =>
  // oxlint-disable-next-line eslint/no-underscore-dangle -- the REST API's name for an identity's links
  person?._links?.avatar?.href ?? person?.imageUrl ?? "";

function showAvatar(avatar: Element | null, person: Person | undefined): void {
  avatar?.setAttribute("aria-label", person?.displayName ?? "");
  avatar?.querySelector("img")?.setAttribute("src", avatarHref(person));
}

/** A deep copy, typed as the element it copies. */
function copyOf<Copied extends Element>(element: Copied): Copied | null {
  const holder = element.ownerDocument.createElement("div");
  holder.append(element.cloneNode(true));
  return holder.querySelector<Copied>(":scope > *");
}

function pullRequestHref(basePath: string, pullRequest: AssignedPullRequest): string {
  const project = encodeURIComponent(pullRequest.repository?.project?.name ?? "");
  const repository = encodeURIComponent(pullRequest.repository?.name ?? "");
  return `${basePath}/${project}/_git/${repository}/pullrequest/${pullRequest.pullRequestId}`;
}

function replaceLast(text: string, search: string, replacement: string): string {
  const index = text.lastIndexOf(search);
  return index === -1
    ? text
    : text.slice(0, index) + replacement + text.slice(index + search.length);
}

/**
 * "Mira requested #12 into" keeps the site's words around the author and the id. React can
 * render them as several text nodes, so each one is filled in.
 */
function showSubtitleWords(
  subtitle: Element,
  template: HTMLElement,
  pullRequest: AssignedPullRequest,
): void {
  const templateAuthor = avatarName(template.querySelector(AUTHOR_AVATAR_SELECTOR) ?? subtitle);
  const templatePath = new URL(template.getAttribute("href") ?? "", "https://relative.invalid");
  const templateId = templatePath.pathname.split("/").at(-1) ?? "";
  const words = [...subtitle.childNodes].filter((node) => node.nodeType === subtitle.TEXT_NODE);
  for (const word of words) {
    const text = word.textContent ?? "";
    const withAuthor =
      templateAuthor === ""
        ? text
        : text.replace(templateAuthor, pullRequest.createdBy?.displayName ?? "");
    word.textContent = replaceLast(withAuthor, templateId, String(pullRequest.pullRequestId));
  }
}

/** The line under the title: author, id, the inbox's repository, and the target branch. */
function showSubtitle(
  row: HTMLElement,
  template: HTMLElement,
  pullRequest: AssignedPullRequest,
): void {
  const subtitle = row.querySelector(SUBTITLE_SELECTOR);
  if (subtitle === null) {
    return;
  }
  showSubtitleWords(subtitle, template, pullRequest);
  subtitle.querySelector(REPOSITORY_SELECTOR)?.replaceChildren(pullRequest.repository?.name ?? "");
  subtitle
    .querySelector(BRANCH_SELECTOR)
    ?.replaceChildren((pullRequest.targetRefName ?? "").replace(BRANCH_PREFIX, ""));
}

/** The site's pills that apply to this pull request, copied from any row on the page that has them. */
function titlePills(
  document: Document,
  pullRequest: AssignedPullRequest,
  reviewerId: string,
): Element[] {
  const isRequired =
    pullRequest.reviewers?.find(({ id }) => id === reviewerId)?.isRequired === true;
  const pills: [string, boolean][] = [
    [DRAFT_PILL_SELECTOR, pullRequest.isDraft === true],
    [CONFLICTS_PILL_SELECTOR, pullRequest.mergeStatus === CONFLICTS_MERGE_STATUS],
    [REQUIRED_PILL_SELECTOR, isRequired],
  ];
  return pills.flatMap(([selector, isShown]) => {
    const pill = isShown ? document.querySelector(selector) : null;
    const copy = pill ? copyOf(pill) : null;
    return copy ? [copy] : [];
  });
}

function showTitle(row: HTMLElement, pullRequest: AssignedPullRequest, reviewerId: string): void {
  const title = row.querySelector(TITLE_SELECTOR);
  if (title) {
    title.textContent = pullRequest.title ?? "";
  }
  for (const pill of row.querySelectorAll(TITLE_PILL_SELECTOR)) {
    pill.remove();
  }
  title?.after(...titlePills(row.ownerDocument, pullRequest, reviewerId));
}

/** The site's "+2" pill after the avatars, showing `rest`, or null when no one is left. */
function showMoreCount(avatars: Element, rest: number): Element | null {
  const morePill = avatars.querySelector(":scope > .bolt-pill");
  if (morePill === null || rest <= 0) {
    return null;
  }
  morePill.querySelector(".bolt-pill-content")?.replaceChildren(`+${rest}`);
  return morePill;
}

/** The site's icon for the reviewer's vote, or null without a vote. */
function createVoteIcon(document: Document, vote: number | undefined): HTMLElement | null {
  const [state, iconName] = VOTE_ICONS.get(vote ?? 0) ?? [];
  if (state === undefined || iconName === undefined) {
    return null;
  }
  const wrapper = Object.assign(document.createElement("span"), {
    className: "fluent-icons-enabled",
  });
  const icon = Object.assign(document.createElement("span"), {
    className: `repos-pr-reviewer-vote absolute ${state} flex-noshrink fabric-icon ${iconName}`,
  });
  icon.setAttribute("aria-hidden", "true");
  wrapper.append(icon);
  return wrapper;
}

/** A copy of the site's reviewer avatar, showing this reviewer and their vote. */
function createReviewerAvatar(template: Element, reviewer: Reviewer & Person): Element | null {
  const avatar = copyOf(template);
  if (avatar === null) {
    return null;
  }
  showAvatar(avatar.querySelector(".bolt-coin"), reviewer);
  avatar.querySelector(VOTE_ICON_SELECTOR)?.remove();
  const voteIcon = createVoteIcon(avatar.ownerDocument, reviewer.vote);
  if (voteIcon) {
    avatar.append(voteIcon);
  }
  return avatar;
}

/**
 * Another site row's avatars, when the row has none: the site leaves the reviewers cell empty
 * on a pull request without reviewers, so there is no avatar to copy.
 */
function addReviewerGroup(row: HTMLElement): void {
  const cell = row.querySelector(REVIEWERS_CELL_SELECTOR);
  const group = row.ownerDocument.querySelector(REVIEWER_GROUP_SELECTOR);
  const copy = group ? copyOf(group) : null;
  if (cell !== null && copy !== null && row.querySelector(REVIEWER_SELECTOR) === null) {
    cell.replaceChildren(copy);
  }
}

/** The first reviewers' avatars, then "+2" for the rest when the site's row has such a pill. */
function showReviewers(row: HTMLElement, pullRequest: AssignedPullRequest): void {
  addReviewerGroup(row);
  const shown = [...row.querySelectorAll(REVIEWER_SELECTOR)];
  const [first] = shown;
  const parent = first?.parentElement;
  if (first === undefined || !parent) {
    return;
  }
  const reviewers = pullRequest.reviewers ?? [];
  const avatars = reviewers.slice(0, MAX_SHOWN_REVIEWERS).flatMap((reviewer) => {
    const avatar = createReviewerAvatar(first, reviewer);
    return avatar === null ? [] : [avatar];
  });
  const morePill = showMoreCount(parent, reviewers.length - avatars.length);
  parent.replaceChildren(...avatars, ...(morePill ? [morePill] : []));
}

function showCreated(row: HTMLElement, pullRequest: AssignedPullRequest, now: number): void {
  const time = row.querySelector("time");
  const created = Date.parse(pullRequest.creationDate ?? "");
  if (time === null || Number.isNaN(created)) {
    return;
  }
  time.setAttribute("datetime", pullRequest.creationDate ?? "");
  time.textContent = relativeTime(
    created,
    now,
    row.ownerDocument.documentElement.lang || undefined,
  );
  time.parentElement?.setAttribute("aria-label", new Date(created).toLocaleString());
}

/** Takes the other features' attributes off the row and its cells, and Azure DevOps's mark of
 *  something new, which belongs to the template's own pull request. */
function removeMarks(row: HTMLElement): void {
  for (const element of [row, ...row.querySelectorAll("*")]) {
    for (const name of element.getAttributeNames()) {
      if (name.startsWith("data-fix-ado-")) {
        element.removeAttribute(name);
      }
    }
  }
  row.classList.remove("bolt-list-row-marked");
  row.style.removeProperty("--fix-ado-work-item-hue");
}

/** A copy of the site's row with only its markup: no other feature's marks, no comments, no menu,
 *  and not marked as new, which the template's own pull request may be. */
function emptyCopy(template: HTMLElement): HTMLElement | null {
  const row = copyOf(template);
  for (const mark of row?.querySelectorAll(SCRIPT_MARK_SELECTOR) ?? []) {
    mark.remove();
  }
  if (row !== null) {
    removeMarks(row);
  }
  row?.querySelector(COMMENTS_CELL_SELECTOR)?.replaceChildren();
  row?.querySelector(ROW_MENU_SELECTOR)?.replaceChildren();
  return row;
}

/** The row of one pull request, built from `template`, a row of the same card or another. */
function buildAssignedRow(
  template: HTMLElement,
  pullRequest: AssignedPullRequest,
  { basePath, now, reviewerId }: RowContext,
): HTMLElement | null {
  const row = emptyCopy(template);
  if (row === null) {
    return null;
  }
  row.setAttribute("href", pullRequestHref(basePath, pullRequest));
  showAvatar(row.querySelector(AUTHOR_AVATAR_SELECTOR), pullRequest.createdBy);
  showTitle(row, pullRequest, reviewerId);
  showSubtitle(row, template, pullRequest);
  showReviewers(row, pullRequest);
  showCreated(row, pullRequest, now);
  return row;
}

export type { RowContext };
export { buildAssignedRow, copyOf };
