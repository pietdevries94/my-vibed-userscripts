// The comment threads in the activity feed of a pull request's Overview.

const FEED_THREAD_SELECTOR = ".activity-feed-list .repos-discussion-thread";
const HEADER_SELECTOR = ".repos-discussion-comment-header";
/** The thread's status dropdown, in the header of its first comment. */
const STATUS_SELECTOR = ".bolt-dropdown-expandable .bolt-dropdown-expandable-button-label";
/** The word Azure DevOps shows as the status of a resolved thread. */
const RESOLVED_STATUS = "Resolved";
/** The dot Azure DevOps puts in the header of a comment the viewer has not seen yet. */
const UNREAD_COMMENT_MARKER_SELECTOR = ".repos-unread-comment-marker";
/** The statuses of a thread that still waits on someone. Won't fix and Closed are done too. */
const UNRESOLVED_STATUSES = new Set(["Active", "Pending"]);

/** A thread whose first comment Azure DevOps has rendered. */
interface FeedThread {
  thread: HTMLElement;
  /** The header of its first comment: who wrote it, when, and the thread's status dropdown. */
  header: HTMLElement;
  /**
   * The box of the time in that header. The script adds its chip and toggle there, after the
   * time. In a narrow window the time sits under the name, and so do they.
   */
  timeBox: Element;
  isResolved: boolean;
  isUnresolved: boolean;
  /** True when Azure DevOps marks one of its comments as unread. */
  hasUnreadComment: boolean;
}

/** The box of the time in a comment's header, or null while the header has no name and time yet. */
function timeBoxOf(header: Element): Element | null {
  const nameAndTime = header.firstElementChild;
  return nameAndTime === null
    ? null
    : (nameAndTime.querySelector(":scope > :has(time)") ?? nameAndTime);
}

function feedThreadOf(thread: HTMLElement): FeedThread | null {
  const header = thread.querySelector<HTMLElement>(HEADER_SELECTOR);
  const timeBox = header === null ? null : timeBoxOf(header);
  if (header === null || timeBox === null) {
    return null;
  }
  const status = header.querySelector(STATUS_SELECTOR)?.textContent.trim() ?? "";
  return {
    hasUnreadComment: thread.querySelector(UNREAD_COMMENT_MARKER_SELECTOR) !== null,
    header,
    isResolved: status === RESOLVED_STATUS,
    isUnresolved: UNRESOLVED_STATUSES.has(status),
    thread,
    timeBox,
  };
}

/** Every thread element of the feed, also one whose comments are still loading. */
const feedThreadElements = (document: Document): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(FEED_THREAD_SELECTOR),
];

export type { FeedThread };
export {
  HEADER_SELECTOR,
  RESOLVED_STATUS,
  UNREAD_COMMENT_MARKER_SELECTOR,
  feedThreadElements,
  feedThreadOf,
};
