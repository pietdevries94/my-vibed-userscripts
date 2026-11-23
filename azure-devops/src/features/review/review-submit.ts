// Submitting a review: every pending comment is posted as its own thread, one request
// at a time, then the vote. Progress is saved after every request, so a closed tab or
// a failed request loses nothing and a retry posts nothing twice.
import type { LineAnchor, PendingComment, ReviewStore } from "./review-store.ts";
import type {
  NewThread,
  PullRequestThread,
  ThreadContext,
} from "../../pull-requests/review-requests.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";

type SubmitClient = Pick<
  AdoClient,
  | "createPullRequestThread"
  | "getAuthenticatedUserId"
  | "getIterationChanges"
  | "getPullRequestIterationIds"
  | "getPullRequestThreads"
  | "setPullRequestVote"
>;

interface SubmitOptions {
  client: SubmitClient;
  store: ReviewStore;
  /** The review's storage key. */
  key: string;
  pullRequest: PullRequestRef;
  /** Called before each comment is sent, with how many were handled so far. */
  onProgress?: (handled: number, total: number) => void;
}

interface ReviewChoices {
  /** The general comment of "Finish your review". Empty for none. */
  summary: string;
  /** 10, 5, -5, -10, or null for no vote. */
  vote: number | null;
}

/** A comment Azure DevOps refused. `httpStatus` is 0 when no answer came. */
interface SubmitFailure {
  id: string;
  httpStatus: number;
}

interface SubmitResult {
  failures: SubmitFailure[];
  /** "skipped" when a comment failed, so the vote waits for the retry. */
  vote: "none" | "sent" | "skipped" | "failed";
}

interface SubmitState {
  options: SubmitOptions;
  /** The threads on the pull request, read once when a comment was tried before. */
  threads: PullRequestThread[] | null;
  newestIteration: number | null;
  changeTrackingIdsByIteration: Map<number, Map<string, number>>;
}

function threadContextOf({ filePath, line, lineLength, side }: LineAnchor): ThreadContext {
  const start = { line, offset: 1 };
  const end = { line, offset: lineLength + 1 };
  return side === "right"
    ? { filePath, rightFileEnd: end, rightFileStart: start }
    : { filePath, leftFileEnd: end, leftFileStart: start };
}

/** True when this thread is the comment, posted by an earlier submit whose answer was lost. */
function isThreadOf({ anchor, content }: PendingComment, thread: PullRequestThread): boolean {
  if (thread.isDeleted === true || thread.comments?.[0]?.content !== content) {
    return false;
  }
  const context = thread.threadContext ?? null;
  if (anchor === null || context === null) {
    return anchor === null && context === null;
  }
  const start = anchor.side === "right" ? context.rightFileStart : context.leftFileStart;
  return context.filePath === anchor.filePath && start?.line === anchor.line;
}

async function changeTrackingIdOf(
  state: SubmitState,
  iteration: number,
  filePath: string,
): Promise<number | null> {
  let idsByPath = state.changeTrackingIdsByIteration.get(iteration);
  if (idsByPath === undefined) {
    const changes = await state.options.client.getIterationChanges(
      state.options.pullRequest,
      iteration,
    );
    idsByPath = new Map(
      changes.flatMap(({ changeTrackingId, item }) =>
        typeof item?.path === "string" ? [[item.path, changeTrackingId]] : [],
      ),
    );
    state.changeTrackingIdsByIteration.set(iteration, idsByPath);
  }
  return idsByPath.get(filePath) ?? null;
}

async function newThreadOf(state: SubmitState, comment: PendingComment): Promise<NewThread> {
  const { anchor, content } = comment;
  if (anchor === null) {
    return { content };
  }
  const threadContext = threadContextOf(anchor);
  const iteration = anchor.iteration ?? state.newestIteration;
  const changeTrackingId =
    iteration === null ? null : await changeTrackingIdOf(state, iteration, anchor.filePath);
  // Without the file's id in the iteration, Azure DevOps places the thread itself.
  return iteration === null || changeTrackingId === null
    ? { content, threadContext }
    : { content, iteration: { changeTrackingId, id: iteration }, threadContext };
}

/** Posts one comment, or finds it on the pull request when an earlier submit tried it. */
async function postComment(state: SubmitState, comment: PendingComment): Promise<number> {
  const { client, key, pullRequest, store } = state.options;
  if (comment.isAttempted) {
    state.threads ??= await client.getPullRequestThreads(pullRequest);
    const posted = state.threads.find((thread) => isThreadOf(comment, thread));
    if (posted !== undefined) {
      return posted.id;
    }
  }
  store.change(key, comment.id, { isAttempted: true });
  return client.createPullRequestThread(pullRequest, await newThreadOf(state, comment));
}

async function postComments(state: SubmitState): Promise<SubmitFailure[]> {
  const { key, onProgress, store } = state.options;
  const pending = store.pending(key);
  const failures: SubmitFailure[] = [];
  for (const [index, comment] of pending.entries()) {
    onProgress?.(index, pending.length);
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, in the order the author reads them
      const postedThreadId = await postComment(state, comment);
      store.change(key, comment.id, { postedThreadId });
    } catch (error) {
      failures.push({
        httpStatus: error instanceof AdoRequestError ? error.httpStatus : 0,
        id: comment.id,
      });
    }
  }
  return failures;
}

async function sendVote({ client, pullRequest }: SubmitOptions, vote: number): Promise<boolean> {
  try {
    const reviewerId = await client.getAuthenticatedUserId();
    if (reviewerId === null) {
      return false;
    }
    await client.setPullRequestVote(pullRequest, { reviewerId, vote });
    return true;
  } catch {
    return false;
  }
}

/**
 * Posts the review. The vote is sent only when every comment is posted. The review is
 * deleted from storage with its last pending comment.
 */
async function submitReview(
  options: SubmitOptions,
  { summary, vote }: ReviewChoices,
): Promise<SubmitResult> {
  if (summary.trim() !== "") {
    // First, so the author reads it before the details.
    options.store.add(options.key, { anchor: null, content: summary.trim() }, "first");
  }
  const iterationIds = await options.client.getPullRequestIterationIds(options.pullRequest);
  const failures = await postComments({
    changeTrackingIdsByIteration: new Map(),
    newestIteration: iterationIds.length === 0 ? null : Math.max(...iterationIds),
    options,
    threads: null,
  });
  if (vote === null) {
    return { failures, vote: "none" };
  }
  if (failures.length > 0) {
    return { failures, vote: "skipped" };
  }
  return { failures, vote: (await sendVote(options, vote)) ? "sent" : "failed" };
}

export type { ReviewChoices, SubmitFailure, SubmitResult };
export { submitReview };
