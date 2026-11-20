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
const BULK_BOX_CLASS = "fix-ado-thread-bulk-buttons";

type ThreadState = "collapsed" | "open";

/**
 * A button above the feed that sets every thread at once, also the ones Azure DevOps renders
 * later, until a reload. Expand all opens them all, Collapse all collapses them all, and
 * Collapse done collapses the resolved ones and opens the others, unread or not.
 */
type BulkAction = "expand-all" | "collapse-all" | "collapse-done";

interface BulkButton {
  action: BulkAction;
  className: string;
  label: string;
}

const BULK_BUTTONS: BulkButton[] = [
  { action: "expand-all", className: "fix-ado-expand-all-threads", label: "Expand all threads" },
  {
    action: "collapse-all",
    className: "fix-ado-collapse-all-threads",
    label: "Collapse all threads",
  },
  {
    action: "collapse-done",
    className: "fix-ado-collapse-done-threads",
    label: "Collapse done threads",
  },
];

/** The state a bulk action gives a thread. */
function bulkStateOf(action: BulkAction, { isResolved }: FeedThread): ThreadState {
  if (action === "collapse-done") {
    return isResolved ? "collapsed" : "open";
  }
  return action === "expand-all" ? "open" : "collapsed";
}

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

function createBulkButton(
  document: Document,
  { action, className, label }: BulkButton,
  onClick: (action: BulkAction) => void,
): HTMLButtonElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text",
    textContent: label,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} bolt-button enabled bolt-focus-treatment`;
  button.append(text);
  button.addEventListener("click", () => {
    onClick(action);
  });
  return button;
}

/**
 * The bulk buttons, in a box with the margins each filter has. Azure DevOps's button style
 * drops a margin on the button itself.
 */
function createBulkBox(document: Document, onClick: (action: BulkAction) => void): HTMLElement {
  const box = Object.assign(document.createElement("div"), {
    className: `${BULK_BOX_CLASS} margin-bottom-16 inline-flex-row`,
  });
  box.append(...BULK_BUTTONS.map((bulkButton) => createBulkButton(document, bulkButton, onClick)));
  return box;
}

/** The bulk buttons' box, first in the bar above the feed (style.css puts it left). Null while the bar is not there. */
function findOrAddBulkBox(
  document: Document,
  onClick: (action: BulkAction) => void,
): HTMLElement | null {
  const bar = document.querySelector(FILTER_SELECTOR)?.parentElement;
  if (bar === null || bar === undefined) {
    return null;
  }
  const existing = bar.querySelector<HTMLElement>(`.${BULK_BOX_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const box = createBulkBox(document, onClick);
  bar.prepend(box);
  return box;
}

/** Sets hidden only when it changes, to keep the page's mutation observer quiet. */
function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) {
    element.hidden = hidden;
  }
}

/** Shows each bulk button only while it would change a thread, and the box only while one shows. */
function showBulkButtons(box: HTMLElement, feedThreads: FeedThread[]): void {
  let isAnyShown = false;
  for (const { action, className } of BULK_BUTTONS) {
    const button = box.querySelector<HTMLElement>(`.${className}`);
    const wouldChange = feedThreads.some(
      (feedThread) => feedThread.thread.dataset.fixAdoThread !== bulkStateOf(action, feedThread),
    );
    if (button !== null) {
      setHidden(button, !wouldChange);
    }
    isAnyShown ||= wouldChange;
  }
  setHidden(box, !isAnyShown);
}

/** The state of a thread the owner has not picked one for: by the last bulk button, or else by its status. */
function unpickedStateOf(feedThread: FeedThread, bulkAction: BulkAction | null): ThreadState {
  if (bulkAction !== null) {
    return bulkStateOf(bulkAction, feedThread);
  }
  return feedThread.isResolved && !feedThread.hasUnreadComment ? "collapsed" : "open";
}

/** Every thread of the feed whose first comment Azure DevOps has rendered. */
const loadedFeedThreads = (document: Document): FeedThread[] =>
  feedThreadElements(document)
    .map((thread) => feedThreadOf(thread))
    .filter((feedThread) => feedThread !== null);

/**
 * The threads in the activity feed of a pull request's Overview, each with a toggle before its
 * author that collapses it to the header of its first comment, also a thread on a file (style.css). A resolved thread starts
 * collapsed, unless Azure DevOps marks one of its comments as unread. A thread the owner opened or collapsed stays that way until a reload.
 * Expand all threads, above the feed, opens every thread, also the ones Azure DevOps renders
 * later, until a reload. Collapse all threads collapses every thread, and Collapse done threads
 * collapses the resolved ones and opens the others, also until a reload. Each shows only while
 * it would change a thread.
 */
function createCollapsibleThreads({ document }: { document: Document }): { sync: () => void } {
  /** The state the owner picked, by thread id. */
  const pickedStates = new Map<string, ThreadState>();
  /** The id of each thread seen with a plain reply field. */
  const knownIds = new WeakMap<HTMLElement, string>();
  /** The last bulk button the owner clicked, or null before the first. */
  let bulkAction: BulkAction | null = null;

  function stateOf(feedThread: FeedThread): ThreadState {
    const picked = pickedStates.get(threadIdOf(feedThread.thread, knownIds) ?? "");
    return picked ?? unpickedStateOf(feedThread, bulkAction);
  }

  function applyBulk(action: BulkAction): void {
    pickedStates.clear();
    bulkAction = action;
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
