// A review on a pull request, as on GitHub: the owner collects comments that only
// they see, then posts them in one go with "Submit review", together with a vote.
import { ADD_ACTION, closeBox, commentBoxAround, hasAddButton } from "./comment-box-buttons.ts";
import type { PendingComment, ReviewStore } from "./review-store.ts";
import { asMarkdown, clickedAction, pendingCountText } from "./review-markup.ts";
import { handleCardAction, keepCardFocus, noteDraft, saveDrafts } from "./card-actions.ts";
import { showInTree, showReview, watchTree } from "./review-view.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import type { ClickedAction } from "./review-markup.ts";
import type { CommentBox } from "./comment-box-buttons.ts";
import type { Drafts } from "./card-actions.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import { openFinishDialog } from "./finish-dialog.ts";
import { openUnsavedEditsDialog } from "./unsaved-edits-dialog.ts";
import { submitReview } from "./review-submit.ts";

interface ReviewOptions {
  client: Parameters<typeof submitReview>[0]["client"] & Pick<AdoClient, "getPullRequestStatus">;
  document: Document;
  store: ReviewStore;
  /** The storage key of a pull request's review. */
  keyOf: (pullRequest: PullRequestRef) => string;
  reload: () => void;
  copy: (text: string) => void;
  confirm: (question: string) => boolean;
}

interface ReviewFeature {
  /** Shows the review of the pull request on the page: its buttons, cards and header. */
  sync: (pullRequest: PullRequestRef | null) => void;
}

/** The pull request on the page, and what the script learned about it. */
interface ShownPullRequest {
  pullRequest: PullRequestRef;
  key: string;
  /** Null until Azure DevOps answered. */
  newestIteration: number | null;
  /** The files the newest iteration changes: the file tree needs them. Null until Azure DevOps answered. */
  changedPaths: string[] | null;
  /** True until Azure DevOps says the pull request is completed or abandoned. */
  isActive: boolean;
  isStatusRequested: boolean;
}

interface ReviewState {
  options: ReviewOptions;
  shown: ShownPullRequest | null;
  /** The edits of pending comments the owner has not saved. They last as long as the page. */
  drafts: Drafts;
}

/** Forgets the drafts of comments that are no longer pending. */
function dropOrphanDrafts(drafts: Drafts, pending: PendingComment[]): void {
  for (const id of drafts.keys()) {
    if (!pending.some((comment) => comment.id === id)) {
      drafts.delete(id);
    }
  }
}

/** What the page should show of the review now. */
function shownReview({ drafts, options, shown }: ReviewState): Parameters<typeof showReview>[1] {
  const pending = shown === null ? [] : options.store.pending(shown.key);
  dropOrphanDrafts(drafts, pending);
  return {
    changedPaths: shown?.changedPaths ?? null,
    drafts,
    isOnPullRequest: shown !== null,
    isPullRequestActive: shown?.isActive ?? true,
    pending,
  };
}

function render(state: ReviewState): void {
  showReview(state.options.document, shownReview(state));
}

/** Asks once whether the pull request is still open, when it has a review. */
function requestStatus(state: ReviewState, shown: ShownPullRequest): void {
  if (shown.isStatusRequested || state.options.store.pending(shown.key).length === 0) {
    return;
  }
  shown.isStatusRequested = true;
  void state.options.client
    .getPullRequestStatus(shown.pullRequest)
    .then((status) => {
      shown.isActive = status === "active";
      render(state);
    })
    // Without an answer the pull request counts as open.
    .catch(() => null);
}

/** Asks which iteration is the newest, and which files it changes. */
async function loadIteration(state: ReviewState, shown: ShownPullRequest): Promise<void> {
  const { client } = state.options;
  const ids = await client.getPullRequestIterationIds(shown.pullRequest);
  if (ids.length === 0) {
    return;
  }
  shown.newestIteration = Math.max(...ids);
  const changes = await client.getIterationChanges(shown.pullRequest, shown.newestIteration);
  shown.changedPaths = changes.flatMap(({ item }) => item?.path ?? []);
  render(state);
}

function show(state: ReviewState, pullRequest: PullRequestRef): ShownPullRequest {
  const key = state.options.keyOf(pullRequest);
  if (state.shown?.key === key) {
    return state.shown;
  }
  const shown: ShownPullRequest = {
    changedPaths: null,
    isActive: true,
    isStatusRequested: false,
    key,
    newestIteration: null,
    pullRequest,
  };
  // Without an answer a comment is placed in the newest iteration when the review is
  // submitted, and the file tree shows a pending comment only under a file whose folders it draws.
  void loadIteration(state, shown).catch(() => null);
  return shown;
}

function addFromBox(state: ReviewState, shown: ShownPullRequest, box: CommentBox | null): void {
  const content = box?.textarea.value.trim() ?? "";
  if (box === null || content === "") {
    return;
  }
  const { anchor } = box;
  state.options.store.add(shown.key, {
    anchor:
      anchor.kind === "general"
        ? null
        : {
            filePath: anchor.filePath,
            iteration: shown.newestIteration,
            line: anchor.line,
            lineLength: anchor.lineLength,
            side: anchor.side,
          },
    content,
  });
  closeBox(box);
  render(state);
}

function openFinish(state: ReviewState, shown: ShownPullRequest): void {
  const { client, document, reload, store } = state.options;
  openFinishDialog({
    discard: () => {
      store.discard(shown.key);
      render(state);
    },
    document,
    onSubmitted: reload,
    pending: () => store.pending(shown.key),
    submit: async (choices, onProgress) =>
      submitReview(
        { client, key: shown.key, onProgress, pullRequest: shown.pullRequest, store },
        choices,
      ),
  });
}

/** Opens "Finish your review". With edits still open it first asks whether to save them. */
function finish(state: ReviewState, shown: ShownPullRequest): void {
  const { drafts, options } = state;
  if (drafts.size === 0) {
    openFinish(state, shown);
    return;
  }
  openUnsavedEditsDialog({
    count: drafts.size,
    document: options.document,
    onAnswer: (shouldSave) => {
      if (shouldSave) {
        saveDrafts({ drafts, key: shown.key, store: options.store });
      }
      drafts.clear();
      render(state);
      openFinish(state, shown);
    },
  });
}

function discard(state: ReviewState, shown: ShownPullRequest): void {
  const { confirm, store } = state.options;
  if (confirm(`Discard ${pendingCountText(store.pending(shown.key).length)}?`)) {
    store.discard(shown.key);
  }
}

function headerActions(state: ReviewState, shown: ShownPullRequest): Record<string, () => void> {
  const { options } = state;
  return {
    copy: () => {
      options.copy(asMarkdown(options.store.pending(shown.key)));
    },
    discard: () => {
      discard(state, shown);
    },
    finish: () => {
      finish(state, shown);
    },
  };
}

/** Does what a click on one of the review's buttons asks. Returns the id of a comment whose edit starts. */
function runAction(
  state: ReviewState,
  shown: ShownPullRequest,
  clicked: ClickedAction,
): string | null {
  const headerAction = headerActions(state, shown)[clicked.action];
  if (clicked.action === ADD_ACTION) {
    addFromBox(state, shown, commentBoxAround(clicked.button));
  } else if (headerAction !== undefined) {
    headerAction();
  }
  const { drafts, options } = state;
  return headerAction === undefined
    ? handleCardAction({ drafts, key: shown.key, store: options.store }, clicked)
    : null;
}

function handleClick(state: ReviewState, event: Event): void {
  const { shown } = state;
  const clicked = clickedAction(event.target);
  if (shown === null || clicked === null) {
    return;
  }
  const restoreFocus = keepCardFocus(state.options.document, clicked.button);
  const editedId = runAction(state, shown, clicked);
  render(state);
  restoreFocus(editedId);
}

/** The box a key press would add to the review: Ctrl+Enter or Cmd+Enter, in a started review. */
function boxToAddFrom(
  state: ReviewState,
  shown: ShownPullRequest,
  event: KeyboardEvent,
): CommentBox | null {
  const isAddKey = event.key === "Enter" && (event.ctrlKey || event.metaKey);
  const box = isAddKey ? commentBoxAround(event.target) : null;
  const hasReview = state.options.store.pending(shown.key).length > 0;
  return box !== null && hasReview && hasAddButton(box) && box.textarea.value.trim() !== ""
    ? box
    : null;
}

function handleKeydown(state: ReviewState, event: KeyboardEvent): void {
  const { shown } = state;
  const box = shown === null ? null : boxToAddFrom(state, shown, event);
  if (shown === null || box === null) {
    return;
  }
  // Before Azure DevOps sees the key, or it would post the comment at once.
  event.preventDefault();
  event.stopImmediatePropagation();
  addFromBox(state, shown, box);
}

function createReview(options: ReviewOptions): ReviewFeature {
  const state: ReviewState = { drafts: new Map(), options, shown: null };
  const { document } = options;
  document.addEventListener("click", (event) => {
    handleClick(state, event);
  });
  document.addEventListener("input", (event) => {
    if (noteDraft(state.drafts, event.target) || commentBoxAround(event.target) !== null) {
      render(state);
    }
  });
  watchTree(document, () => {
    showInTree(document, shownReview(state));
  });
  document.addEventListener(
    "keydown",
    (event) => {
      handleKeydown(state, event);
    },
    true,
  );
  return {
    sync(pullRequest) {
      state.shown = pullRequest === null ? null : show(state, pullRequest);
      if (state.shown !== null) {
        requestStatus(state, state.shown);
      }
      render(state);
    },
  };
}

export type { ReviewFeature, ReviewOptions };
export { createReview };
