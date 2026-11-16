import { createFoldToggle, showFoldToggleState } from "../../core/fold-toggle.ts";
import { feedThreadElements, feedThreadOf } from "../../pull-requests/feed-threads.ts";
import type { FeedThread } from "../../pull-requests/feed-threads.ts";

const TOGGLE_CLASS = "fix-ado-thread-toggle";
const TOGGLE_LABELS = { folded: "Expand thread", open: "Collapse thread" };
/** The reply box's field carries the thread's id in a class name. */
const THREAD_ID_PATTERN = /\bthreadId-(?<id>\d+)\b/u;

type ThreadState = "collapsed" | "open";

/** The id Azure DevOps gave the thread, or null while its reply box is not a plain field. */
function threadIdOf(thread: HTMLElement): string | null {
  const field = thread.querySelector(".repos-discussion-thread-reply input");
  return THREAD_ID_PATTERN.exec(field?.className ?? "")?.groups?.id ?? null;
}

/** The toggle of a thread, added after the name and time of its first comment when it is not there yet. */
function findOrAddToggle(
  { header, nameAndTime, thread }: FeedThread,
  onClick: (thread: HTMLElement) => void,
): HTMLButtonElement {
  const existing = header.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const toggle = createFoldToggle(thread.ownerDocument, TOGGLE_CLASS);
  toggle.addEventListener("click", () => {
    onClick(thread);
  });
  nameAndTime.append(toggle);
  return toggle;
}

/**
 * The threads in the activity feed of a pull request's Overview, each with a toggle that
 * collapses it to the header of its first comment, also a thread on a file (style.css). A resolved thread starts
 * collapsed. A thread the owner opened or collapsed stays that way until a reload.
 */
function createCollapsibleThreads({ document }: { document: Document }): { sync: () => void } {
  /** The state the owner picked, by thread id. */
  const pickedStates = new Map<string, ThreadState>();

  function stateOf({ isResolved, thread }: FeedThread): ThreadState {
    const picked = pickedStates.get(threadIdOf(thread) ?? "");
    return picked ?? (isResolved ? "collapsed" : "open");
  }

  function flip(thread: HTMLElement): void {
    const threadId = threadIdOf(thread);
    if (threadId !== null) {
      pickedStates.set(threadId, thread.dataset.fixAdoThread === "open" ? "collapsed" : "open");
      sync();
    }
  }

  function syncThread(feedThread: FeedThread): void {
    const state = stateOf(feedThread);
    if (feedThread.thread.dataset.fixAdoThread !== state) {
      feedThread.thread.dataset.fixAdoThread = state;
    }
    showFoldToggleState(findOrAddToggle(feedThread, flip), state === "open", TOGGLE_LABELS);
  }

  function sync(): void {
    for (const thread of feedThreadElements(document)) {
      const feedThread = feedThreadOf(thread);
      if (feedThread !== null) {
        syncThread(feedThread);
      }
    }
  }

  return { sync };
}

export { createCollapsibleThreads };
