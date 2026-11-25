// A pull request row the script builds, as a copy of one of Azure DevOps's own rows in the
// same card, so it keeps the site's markup and wording ("requested … into", "Created").
import type { AssignedPullRequest, Person } from "./assigned-tabs.ts";
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

/** "Mira requested #12 into" keeps the site's words around the author and the id. */
function showSubtitleWords(
  subtitle: Element,
  template: HTMLElement,
  pullRequest: AssignedPullRequest,
): void {
  const words = subtitle.firstChild;
  const templateAuthor = avatarName(template.querySelector(AUTHOR_AVATAR_SELECTOR) ?? subtitle);
  const templateId = template.getAttribute("href")?.split("/").at(-1) ?? "";
  if (words?.nodeType !== subtitle.TEXT_NODE || templateAuthor === "") {
    return;
  }
  const withAuthor = (words.textContent ?? "").replace(
    templateAuthor,
    pullRequest.createdBy?.displayName ?? "",
  );
  words.textContent = replaceLast(withAuthor, templateId, String(pullRequest.pullRequestId));
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

/** The first reviewers' avatars, then "+2" for the rest when the site's row has such a pill. */
function showReviewers(row: HTMLElement, pullRequest: AssignedPullRequest): void {
  const shown = [...row.querySelectorAll(REVIEWER_SELECTOR)];
  const [first] = shown;
  const parent = first?.parentElement;
  if (first === undefined || !parent) {
    return;
  }
  const reviewers = pullRequest.reviewers ?? [];
  const avatars = reviewers.slice(0, MAX_SHOWN_REVIEWERS).flatMap((reviewer) => {
    const avatar = copyOf(first);
    showAvatar(avatar?.querySelector(".bolt-coin") ?? null, reviewer);
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

/** A copy of the site's row with only its markup: no other feature's marks, no comments, no menu. */
function emptyCopy(template: HTMLElement): HTMLElement | null {
  const row = copyOf(template);
  for (const mark of row?.querySelectorAll(SCRIPT_MARK_SELECTOR) ?? []) {
    mark.remove();
  }
  row?.querySelector(COMMENTS_CELL_SELECTOR)?.replaceChildren();
  row?.querySelector(ROW_MENU_SELECTOR)?.replaceChildren();
  return row;
}

/** The row of one pull request, built from `template`, a row of the same card. */
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
