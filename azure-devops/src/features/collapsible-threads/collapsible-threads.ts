import { createFoldToggle, showFoldToggleState } from "../../core/fold-toggle.ts";
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
/** The feed's filter, in the bar above the feed. */
const FILTER_SELECTOR = ".repos-activity-filter-dropdown";
const EXPAND_ALL_CLASS = "fix-ado-expand-all-threads";
const EXPAND_ALL_LABEL = "Expand all threads";

type ThreadState = "collapsed" | "open";

/** The id Azure DevOps gave the thread, or null while its reply box is not a plain field. */
function threadIdOf(thread: HTMLElement): string | null {
  const field = thread.querySelector(".repos-discussion-thread-reply input");
  return THREAD_ID_PATTERN.exec(field?.className ?? "")?.groups?.id ?? null;
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

/**
 * The Expand all threads button, in a box with the margins each filter has. Azure DevOps's
 * button style drops a margin on the button itself.
 */
function createExpandAllBox(document: Document, onClick: () => void): HTMLElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text",
    textContent: EXPAND_ALL_LABEL,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${EXPAND_ALL_CLASS} bolt-button enabled bolt-focus-treatment`;
  button.append(text);
  button.addEventListener("click", onClick);
  const box = Object.assign(document.createElement("div"), {
    className: `${EXPAND_ALL_CLASS}-box margin-bottom-16 inline-flex-row`,
  });
  box.append(button);
  return box;
}

/** Adds Expand all threads first in the bar above the feed, when it is not there yet (style.css puts it left). */
function addExpandAllButton(document: Document, onClick: () => void): void {
  const bar = document.querySelector(FILTER_SELECTOR)?.parentElement;
  if (bar !== null && bar !== undefined && bar.querySelector(`.${EXPAND_ALL_CLASS}`) === null) {
    bar.prepend(createExpandAllBox(document, onClick));
  }
}

/**
 * The threads in the activity feed of a pull request's Overview, each with a toggle before its
 * author that collapses it to the header of its first comment, also a thread on a file (style.css). A resolved thread starts
 * collapsed, unless Azure DevOps marks one of its comments as unread. A thread the owner opened or collapsed stays that way until a reload.
 * Expand all threads, above the feed, opens every thread, also the ones Azure DevOps renders
 * later, until a reload.
 */
function createCollapsibleThreads({ document }: { document: Document }): { sync: () => void } {
  /** The state the owner picked, by thread id. */
  const pickedStates = new Map<string, ThreadState>();
  let isAllExpanded = false;

  function stateOf({ hasUnreadComment, isResolved, thread }: FeedThread): ThreadState {
    const picked = pickedStates.get(threadIdOf(thread) ?? "");
    return picked ?? (isResolved && !hasUnreadComment && !isAllExpanded ? "collapsed" : "open");
  }

  function expandAll(): void {
    pickedStates.clear();
    isAllExpanded = true;
    sync();
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
    const toggle = findOrCreateToggle(feedThread, flip);
    placeToggle(toggle, toggleBoxOf(feedThread, state));
    showFoldToggleState(toggle, state === "open", TOGGLE_LABELS);
  }

  function sync(): void {
    addExpandAllButton(document, expandAll);
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
