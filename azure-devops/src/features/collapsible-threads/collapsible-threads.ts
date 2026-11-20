import type { GroupStates, ThreadGroup } from "./bulk-buttons.ts";
import { createFoldToggle, showFoldToggleState } from "../../core/fold-toggle.ts";
import {
  doneThreadsOf,
  findOrAddBulkBox,
  groupStatesAfter,
  isEveryCollapsed,
  showBulkButtons,
} from "./bulk-buttons.ts";
import { feedThreadElements, feedThreadOf } from "../../pull-requests/feed-threads.ts";
import type { FeedThread } from "../../pull-requests/feed-threads.ts";

const TOGGLE_CLASS = "fix-ado-thread-toggle";
const TOGGLE_LABELS = { folded: "Expand thread", name: "Thread", open: "Collapse thread" };
/** The reply box's field carries the thread's id in a class name. */
const THREAD_ID_PATTERN = /\bthreadId-(?<id>\d+)\b/u;
const FILE_HEADER_SELECTOR = ".comment-file-header";
const FILE_TITLE_SELECTOR = ".comment-file-header-title";
/** The column of a comment with its header and text. The author's avatar sits before it. */
const AUTHOR_COLUMN_SELECTOR = ".repos-comment-editor-fit";

type ThreadState = "collapsed" | "open";

/**
 * The id Azure DevOps gave the thread, or null when it is not known yet. Only the reply box's
 * plain field carries it: a click swaps that for a textarea without it, so the id is remembered.
 */
function threadIdOf(thread: HTMLElement, knownIds: WeakMap<HTMLElement, string>): string | null {
  const field = thread.querySelector(".repos-discussion-thread-reply input");
  const id = THREAD_ID_PATTERN.exec(field?.className ?? "")?.groups?.id;
  if (id !== undefined) {
    knownIds.set(thread, id);
  }
  return id ?? knownIds.get(thread) ?? null;
}

/** The header with the file's name above a thread on a file, or null for a thread on the pull request. */
function fileHeaderOf(thread: HTMLElement): Element | null {
  const before = thread.previousElementSibling;
  return before?.matches(FILE_HEADER_SELECTOR) === true ? before : null;
}

/** The toggle of a thread, made when it has none yet. Where it goes depends on the thread's state. */
function findOrCreateToggle(
  { header, thread }: FeedThread,
  onClick: (thread: HTMLElement) => void,
): HTMLButtonElement {
  const existing =
    thread.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`) ??
    fileHeaderOf(thread)?.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (existing !== null && existing !== undefined) {
    return existing;
  }
  const toggle = createFoldToggle(header.ownerDocument, TOGGLE_CLASS);
  toggle.addEventListener("click", () => {
    onClick(thread);
  });
  return toggle;
}

/**
 * Where the toggle goes: before the file's icon on an open thread on a file, or else before
 * the author of the first comment. A collapsed thread hides its file's header.
 */
function toggleBoxOf({ header, thread }: FeedThread, state: ThreadState): Element {
  const fileTitle = fileHeaderOf(thread)?.querySelector(FILE_TITLE_SELECTOR) ?? null;
  if (state === "open" && fileTitle !== null) {
    return fileTitle;
  }
  return header.closest(AUTHOR_COLUMN_SELECTOR)?.parentElement ?? header;
}

/** Puts the toggle first in its box. Moves it only when it is somewhere else, to keep the page's mutation observer quiet. */
function placeToggle(toggle: HTMLButtonElement, box: Element): void {
  if (box.firstElementChild !== toggle) {
    box.prepend(toggle);
  }
}

/** The state of a thread the owner has not picked one for: by the last bulk click on its group, or else by its status. */
function unpickedStateOf(feedThread: FeedThread, groupStates: GroupStates): ThreadState {
  const groupState = feedThread.isDone ? groupStates.done : groupStates.other;
  return groupState ?? (feedThread.isDone && !feedThread.hasUnreadComment ? "collapsed" : "open");
}

/**
 * Drops the owner's picks before a bulk click, read before it changes anything. Expand done
 * threads drops only the done threads' picks; every other click drops all.
 */
function dropPicks({
  feedThreads,
  group,
  knownIds,
  pickedStates,
}: {
  feedThreads: FeedThread[];
  knownIds: WeakMap<HTMLElement, string>;
  pickedStates: Map<string, ThreadState>;
  group: ThreadGroup;
}): void {
  const doneThreads = doneThreadsOf(feedThreads);
  if (group !== "done" || !isEveryCollapsed(doneThreads)) {
    pickedStates.clear();
    return;
  }
  for (const { thread } of doneThreads) {
    pickedStates.delete(threadIdOf(thread, knownIds) ?? "");
  }
}

/** Every thread of the feed whose first comment Azure DevOps has rendered. */
const loadedFeedThreads = (document: Document): FeedThread[] =>
  feedThreadElements(document)
    .map((thread) => feedThreadOf(thread))
    .filter((feedThread) => feedThread !== null);

/**
 * The threads in the activity feed of a pull request's Overview, each with a toggle before its
 * author that collapses it to the header of its first comment, also a thread on a file (style.css). A done thread, such as
 * a resolved one, starts collapsed, unless Azure DevOps marks one of its comments as unread. A thread the owner opened or collapsed stays that way until a reload.
 * Above the feed, Collapse all threads collapses every thread, also the ones Azure DevOps
 * renders later, until a reload; once all are collapsed it reads Expand all threads. Collapse
 * done threads collapses the done ones and opens the others; once all done ones are collapsed
 * it reads Expand done threads, which opens them and leaves the others as they are.
 */
function createCollapsibleThreads({ document }: { document: Document }): { sync: () => void } {
  /** The state the owner picked, by thread id. */
  const pickedStates = new Map<string, ThreadState>();
  /** The id of each thread seen with a plain reply field. */
  const knownIds = new WeakMap<HTMLElement, string>();
  let groupStates: GroupStates = { done: null, other: null };

  function stateOf(feedThread: FeedThread): ThreadState {
    const picked = pickedStates.get(threadIdOf(feedThread.thread, knownIds) ?? "");
    return picked ?? unpickedStateOf(feedThread, groupStates);
  }

  function applyBulk(group: ThreadGroup): void {
    const feedThreads = loadedFeedThreads(document);
    dropPicks({ feedThreads, group, knownIds, pickedStates });
    groupStates = groupStatesAfter(group, feedThreads, groupStates);
    sync();
  }

  function flip(thread: HTMLElement): void {
    const threadId = threadIdOf(thread, knownIds);
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
    const toggle = findOrCreateToggle(feedThread, flip);
    placeToggle(toggle, toggleBoxOf(feedThread, state));
    showFoldToggleState(toggle, state === "open", TOGGLE_LABELS);
  }

  function sync(): void {
    const box = findOrAddBulkBox(document, applyBulk);
    const feedThreads = loadedFeedThreads(document);
    for (const feedThread of feedThreads) {
      syncThread(feedThread);
    }
    if (box !== null) {
      showBulkButtons(box, feedThreads);
    }
  }

  return { sync };
}

export { createCollapsibleThreads };
export type { ThreadState };
