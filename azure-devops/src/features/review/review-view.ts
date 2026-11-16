// What a review shows on the page: its button in the comment boxes, the pending
// comments under their lines and in the file tree, and the header in the tab bar.
import type { PendingComment } from "./review-store.ts";
import type { ShownComment } from "./pending-card.ts";
import { closestElement } from "../../core/closest-element.ts";
import { syncAddButtons } from "./comment-box-buttons.ts";
import { syncCardSpacers } from "./card-spacers.ts";
import { syncEditorCards } from "./editor-cards.ts";
import { syncFilePendingList } from "./file-pending-list.ts";
import { syncHeader } from "./review-header.ts";
import { syncPendingCards } from "./pending-cards.ts";
import { syncTreePendingRows } from "./tree-pending-rows.ts";

const TREE_SELECTOR = ".repos-changes-explorer-tree";
/** Every class of the script's own review elements starts with this. */
const OWN_CLASS_PREFIX = "fix-ado-review";

interface ShownReview {
  /** The pending comments of the pull request on the page. */
  pending: PendingComment[];
  /** The unsaved edits of pending comments, by comment id. */
  drafts: ReadonlyMap<string, string>;
  /** False on a page that is not a pull request. */
  isOnPullRequest: boolean;
  /** False for a completed or abandoned pull request. */
  isPullRequestActive: boolean;
  /** The files the pull request changes. Null until Azure DevOps answered. */
  changedPaths: string[] | null;
}

/** A copy of a comment with its draft. The comment itself goes back into storage as it is. */
function withDraft(comment: PendingComment, drafts: ShownReview["drafts"]): ShownComment {
  return { ...comment, draft: drafts.get(comment.id) ?? null };
}

function showReview(document: Document, review: ShownReview): void {
  const { changedPaths, isOnPullRequest, isPullRequestActive } = review;
  const pending = review.pending.map((comment) => withDraft(comment, review.drafts));
  if (isOnPullRequest) {
    syncAddButtons(document, pending.length > 0);
  }
  syncPendingCards(document, pending);
  syncCardSpacers(document);
  const inEditor = syncEditorCards(document, pending);
  // A comment the editor has no room for, or cannot be reached for, shows in a list.
  syncFilePendingList(
    document,
    pending.filter(({ id }) => !inEditor.has(id)),
  );
  syncTreePendingRows(document, { changedPaths, pending });
  syncHeader(document, { count: pending.length, isPullRequestActive });
}

/** Shows only the file tree's part of the review: its pending rows and their room. */
function showInTree(document: Document, { changedPaths, drafts, pending }: ShownReview): void {
  syncTreePendingRows(document, {
    changedPaths,
    pending: pending.map((comment) => withDraft(comment, drafts)),
  });
}

function isOwnNode(node: Node): boolean {
  return "className" in node && String(node.className).includes(OWN_CLASS_PREFIX);
}

/** True when Azure DevOps drew or dropped rows of the file tree. The script's own rows do not count. */
function isTreeChange({ addedNodes, removedNodes, target }: MutationRecord): boolean {
  const isInTree = "closest" in target && closestElement(target, TREE_SELECTOR) !== null;
  return isInTree && [...addedNodes, ...removedNodes].some((node) => !isOwnNode(node));
}

/**
 * Calls `onChange` as soon as Azure DevOps redraws rows of the file tree, before the
 * browser paints them. The tree redraws while it scrolls; the script's usual wait for
 * the page to settle would show each file a moment before its pending comments.
 */
function watchTree(document: Document, onChange: () => void): void {
  const view = document.defaultView;
  if (view === null) {
    return;
  }
  new view.MutationObserver((records) => {
    if (records.some((record) => isTreeChange(record))) {
      onChange();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

export { showInTree, showReview, watchTree };
