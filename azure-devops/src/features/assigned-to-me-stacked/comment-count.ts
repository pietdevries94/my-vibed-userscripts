// The comment count of a built row, as Azure DevOps shows it on its own rows: the number of
// comment threads, or "2/5" with a warning icon while 2 of the 5 are still active.
import type { PullRequestThread, ReviewRequests } from "../../pull-requests/review-requests.ts";

interface CommentCount {
  active: number;
  total: number;
}

const TEXT_COMMENT_TYPE = "text";
const ACTIVE_STATUSES = new Set(["active", "pending"]);

function countComments(threads: PullRequestThread[]): CommentCount {
  const commentThreads = threads.filter(
    ({ comments, isDeleted }) =>
      isDeleted !== true &&
      (comments ?? []).some(({ commentType }) => commentType === TEXT_COMMENT_TYPE),
  );
  const active = commentThreads.filter(({ status }) => ACTIVE_STATUSES.has(status ?? "")).length;
  return { active, total: commentThreads.length };
}

/** The site's icon before the count: a warning while threads are active, else a feed. */
function createCommentIcon(document: Document, hasActive: boolean): HTMLElement {
  const wrapper = Object.assign(document.createElement("span"), {
    className: "fluent-icons-enabled",
  });
  const icon = Object.assign(document.createElement("span"), {
    className: hasActive
      ? "repos-pr-active-comment-icon flex-noshrink fabric-icon ms-Icon--ChatWarning"
      : "flex-noshrink fabric-icon ms-Icon--ActivityFeed",
  });
  icon.setAttribute("aria-hidden", "true");
  wrapper.append(icon);
  return wrapper;
}

/** The site's group of icon and count, or null without comments, as the site shows none then. */
function createCommentCount(
  document: Document,
  { active, total }: CommentCount,
): HTMLElement | null {
  if (total === 0) {
    return null;
  }
  const hasActive = active > 0;
  const group = Object.assign(document.createElement("div"), {
    className: hasActive ? "flex-row flex-center" : "flex-row flex-center secondary-text",
  });
  group.setAttribute("role", "group");
  group.setAttribute(
    "aria-label",
    hasActive ? `${active} of ${total} comments active` : `${total} comments`,
  );
  const count = Object.assign(document.createElement("span"), {
    className: hasActive
      ? "repos-pr-list-comment-count has-active-comments"
      : "repos-pr-list-comment-count",
    textContent: hasActive ? `${active}/${total}` : String(total),
  });
  count.setAttribute("aria-hidden", "true");
  group.append(createCommentIcon(document, hasActive), count);
  return group;
}

/** Shows the count in the row's comments cell, which starts empty, once the threads are in. */
function showCommentCount(cell: Element | null, count: CommentCount | undefined): void {
  const shown =
    count === undefined || cell === null ? null : createCommentCount(cell.ownerDocument, count);
  if (shown !== null) {
    cell?.append(shown);
  }
}

/** A listed pull request, as far as fetching its threads needs it. */
interface ThreadsOwner {
  pullRequestId: number;
  repository?: { name?: string; project?: { name?: string } };
}

/** Each pull request with its comment count. One whose threads fail to load shows no count. */
async function withComments<Listed extends ThreadsOwner>(
  client: ReviewRequests,
  pullRequests: Listed[],
): Promise<(Listed & { comments?: CommentCount })[]> {
  return Promise.all(
    pullRequests.map(async (pullRequest) => {
      const ref = {
        project: pullRequest.repository?.project?.name ?? "",
        pullRequestId: pullRequest.pullRequestId,
        repository: pullRequest.repository?.name ?? "",
      };
      const threads = await client.getPullRequestThreads(ref).catch(() => null);
      return threads === null ? pullRequest : { ...pullRequest, comments: countComments(threads) };
    }),
  );
}

export type { CommentCount };
export { countComments, createCommentCount, showCommentCount, withComments };
