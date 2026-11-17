// The comment threads in the activity feed of a pull request's Overview.

const FEED_THREAD_SELECTOR = ".activity-feed-list .repos-discussion-thread";
const HEADER_SELECTOR = ".repos-discussion-comment-header";
/** The thread's status dropdown, in the header of its first comment. */
const STATUS_SELECTOR = ".bolt-dropdown-expandable .bolt-dropdown-expandable-button-label";
/** The word Azure DevOps shows as the status of a resolved thread. */
const RESOLVED_STATUS = "Resolved";

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
}

function feedThreadOf(thread: HTMLElement): FeedThread | null {
  const header = thread.querySelector<HTMLElement>(HEADER_SELECTOR);
  const nameAndTime = header?.firstElementChild ?? null;
  if (header === null || nameAndTime === null) {
    return null;
  }
  const timeBox = nameAndTime.querySelector(":scope > :has(time)") ?? nameAndTime;
  const status = header.querySelector(STATUS_SELECTOR)?.textContent.trim();
  return { header, isResolved: status === RESOLVED_STATUS, thread, timeBox };
}

/** Every thread element of the feed, also one whose comments are still loading. */
const feedThreadElements = (document: Document): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(FEED_THREAD_SELECTOR),
];

export type { FeedThread };
export { RESOLVED_STATUS, feedThreadElements, feedThreadOf };
