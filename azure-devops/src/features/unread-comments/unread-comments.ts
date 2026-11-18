import {
  HEADER_SELECTOR,
  UNREAD_COMMENT_MARKER_SELECTOR,
} from "../../pull-requests/feed-threads.ts";
import { scrollBehaviorOf } from "../../core/scroll-behavior.ts";

const FEED_SELECTOR = ".activity-feed-list";
const ROW_SELECTOR = ".bolt-timeline-row";
const THREAD_SELECTOR = ".repos-discussion-thread";
const COMMENT_SELECTOR = ".repos-comment-viewer";
/** Azure DevOps marks the timeline of a row with new activity, also before it renders the row's comments. */
const NEW_ROW_SELECTOR = ".activity-feed-sequence.new";
/** The pull request's tab bar, which sticks to the top of the box the feed scrolls in. */
const STICKY_TAB_BAR_SELECTOR = ".bolt-tabbar.sticky";
/** The feed's filter, in the bar above the feed. */
const FILTER_SELECTOR = ".repos-activity-filter-dropdown";
const FIRST_UNREAD_CLASS = "fix-ado-first-unread";
const FIRST_UNREAD_LABEL = "Go to first unread";
const NEXT_UNREAD_CLASS = "fix-ado-next-unread";
const NEXT_UNREAD_LABEL = "Go to next unread";

/** Where a comment sits in its group of unread comments. style.css draws one glow around the group. */
type UnreadMark = "only" | "first" | "middle" | "last";

/**
 * A place Go to first unread and Go to next unread scroll to: a group of unread comments that
 * follow each other in a thread, or the row of a new thread Azure DevOps has not rendered yet.
 */
interface UnreadStop {
  /** What the scroll goes to and focus moves to: the group's first comment, or the row. */
  target: HTMLElement;
  /** The group's comments. None for a row. */
  comments: HTMLElement[];
}

/** The feed's rows as shown: Azure DevOps keeps them newest first, Activity order may turn them around. */
function rowsAsShown(feed: HTMLElement): HTMLElement[] {
  const rows = [...feed.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
  return feed.dataset.fixAdoActivityOrder === "oldest-first" ? rows.toReversed() : rows;
}

/** The groups of unread comments that follow each other in a thread, in order. */
function unreadGroupsOf(thread: Element): HTMLElement[][] {
  const groups: HTMLElement[][] = [];
  let group: HTMLElement[] = [];
  for (const comment of thread.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
    if (comment.querySelector(UNREAD_COMMENT_MARKER_SELECTOR) === null) {
      group = [];
    } else {
      if (group.length === 0) {
        groups.push(group);
      }
      group.push(comment);
    }
  }
  return groups;
}

function markOf(index: number, size: number): UnreadMark {
  if (size === 1) {
    return "only";
  }
  if (index === 0) {
    return "first";
  }
  return index === size - 1 ? "last" : "middle";
}

/** Marks every comment of every group, and clears the mark of a comment that is no longer unread. */
function markUnreadGroups(document: Document, groups: HTMLElement[][]): void {
  const marked = new Set<HTMLElement>();
  for (const group of groups) {
    for (const [index, comment] of group.entries()) {
      const mark = markOf(index, group.length);
      if (comment.dataset.fixAdoUnread !== mark) {
        comment.dataset.fixAdoUnread = mark;
      }
      marked.add(comment);
    }
  }
  for (const comment of document.querySelectorAll<HTMLElement>("[data-fix-ado-unread]")) {
    if (!marked.has(comment)) {
      delete comment.dataset.fixAdoUnread;
    }
  }
}

function stopOfGroup(comments: HTMLElement[]): UnreadStop[] {
  const [first] = comments;
  return first === undefined ? [] : [{ comments, target: first }];
}

/** The stops in a row: its groups, or the row itself while its new thread is not rendered. */
function stopsOfRow(row: HTMLElement): UnreadStop[] {
  const thread = row.querySelector(THREAD_SELECTOR);
  if (thread === null) {
    return [];
  }
  if (thread.querySelector(HEADER_SELECTOR) === null) {
    return row.querySelector(NEW_ROW_SELECTOR) === null ? [] : [{ comments: [], target: row }];
  }
  return unreadGroupsOf(thread).flatMap((comments) => stopOfGroup(comments));
}

/** The stops in the order the feed shows them. */
function readStops(document: Document): UnreadStop[] {
  const feed = document.querySelector<HTMLElement>(FEED_SELECTOR);
  return feed === null ? [] : rowsAsShown(feed).flatMap((row) => stopsOfRow(row));
}

function createButton(document: Document, className: string, label: string): HTMLButtonElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text",
    textContent: label,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} bolt-button enabled bolt-focus-treatment`;
  button.append(text);
  return button;
}

/** Go to first unread, in a box with the margins each filter has. */
function createFirstUnreadBox(document: Document, onClick: () => void): HTMLElement {
  const button = createButton(document, FIRST_UNREAD_CLASS, FIRST_UNREAD_LABEL);
  button.addEventListener("click", onClick);
  const box = Object.assign(document.createElement("div"), {
    className: `${FIRST_UNREAD_CLASS}-box margin-bottom-16 margin-right-8 inline-flex-row`,
  });
  box.append(button);
  return box;
}

/** Go to first unread, first in the bar above the feed (style.css puts it left). Null while the bar is not there. */
function findOrAddFirstUnreadButton(
  document: Document,
  onClick: () => void,
): HTMLButtonElement | null {
  const bar = document.querySelector(FILTER_SELECTOR)?.parentElement;
  if (bar === null || bar === undefined) {
    return null;
  }
  if (bar.querySelector(`.${FIRST_UNREAD_CLASS}`) === null) {
    bar.prepend(createFirstUnreadBox(document, onClick));
  }
  return bar.querySelector<HTMLButtonElement>(`.${FIRST_UNREAD_CLASS}`);
}

/** The last comment of a group, where Go to next unread goes. Null for a row. */
const lastCommentOf = ({ comments }: UnreadStop): HTMLElement | null => comments.at(-1) ?? null;

/**
 * Go to next unread, last in the last comment of a group, so it shows inside the group's glow.
 * Added when it is not there yet, and moved back to the end when Azure DevOps adds after it.
 */
function findOrAddNextUnreadButton(comment: HTMLElement, onClick: () => void): HTMLButtonElement {
  const existing = comment.querySelector<HTMLButtonElement>(`:scope > .${NEXT_UNREAD_CLASS}`);
  const button =
    existing ?? createButton(comment.ownerDocument, NEXT_UNREAD_CLASS, NEXT_UNREAD_LABEL);
  if (existing === null) {
    button.addEventListener("click", onClick);
  }
  if (comment.lastElementChild !== button) {
    comment.append(button);
  }
  return button;
}

/** Scrolls an element into view, and waits for the end where the browser says when that is. */
async function scrollIntoViewAndWait(
  element: Element,
  options: ScrollIntoViewOptions,
): Promise<void> {
  // Chrome returns a promise that settles when the scroll ends. Firefox returns nothing: focus
  // then moves while the scroll runs, which preventScroll allows.
  const scrollable: { scrollIntoView: (scrollOptions: ScrollIntoViewOptions) => unknown } = element;
  const scrolled = scrollable.scrollIntoView(options);
  if (scrolled instanceof Promise) {
    await scrolled;
  }
}

/** Tells style.css how much room to leave above a stop, so the sticky tab bar does not cover it. */
function leaveRoomForTabBar(document: Document): void {
  const height = `${document.querySelector<HTMLElement>(STICKY_TAB_BAR_SELECTOR)?.offsetHeight ?? 0}px`;
  const feed = document.querySelector<HTMLElement>(FEED_SELECTOR);
  if (feed !== null && feed.style.getPropertyValue("--fix-ado-sticky-height") !== height) {
    feed.style.setProperty("--fix-ado-sticky-height", height);
  }
}

/** The stop, or its thread when the owner collapsed the thread and the stop is hidden. */
function shownPartOf(target: HTMLElement): HTMLElement {
  return target.checkVisibility()
    ? target
    : (target.closest<HTMLElement>(THREAD_SELECTOR) ?? target);
}

/** Scrolls to a stop, then moves focus there. Of scrolls that overlap, only the latest moves focus. */
function createStopScroller(document: Document): (stop: UnreadStop | undefined) => Promise<void> {
  let scrollCount = 0;
  return async (stop) => {
    if (stop === undefined) {
      return;
    }
    scrollCount += 1;
    const scroll = scrollCount;
    const { target } = stop;
    leaveRoomForTabBar(document);
    await scrollIntoViewAndWait(shownPartOf(target), {
      behavior: scrollBehaviorOf(document),
      block: "start",
    });
    if (scroll === scrollCount) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  };
}

/** Removes every Go to next unread but the kept ones. */
function removeNextUnreadButtons(document: Document, kept: Set<HTMLButtonElement>): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(`.${NEXT_UNREAD_CLASS}`)) {
    if (!kept.has(button)) {
      button.remove();
    }
  }
}

/**
 * Unread comments on a pull request's Overview. Azure DevOps marks each one with a dot. Unread
 * comments that follow each other in a thread form a group, with one glow around it (style.css).
 * Go to first unread, above the feed, scrolls to the first group, and glows while there is one.
 * Go to next unread, at the bottom of each group but the last, scrolls to the
 * next group. A new thread Azure DevOps has not rendered yet counts as a group: its row is where
 * the scroll goes.
 */
function createUnreadComments({ document }: { document: Document }): { sync: () => void } {
  const goTo = createStopScroller(document);

  function goToNextAfter(target: HTMLElement): void {
    const stops = readStops(document);
    const index = stops.findIndex((stop) => stop.target === target);
    void goTo(index === -1 ? undefined : stops[index + 1]);
  }

  function syncNextUnreadButtons(stops: UnreadStop[]): void {
    const kept = new Set<HTMLButtonElement>();
    for (const stop of stops.slice(0, -1)) {
      const lastComment = lastCommentOf(stop);
      if (lastComment !== null) {
        kept.add(
          findOrAddNextUnreadButton(lastComment, () => {
            goToNextAfter(stop.target);
          }),
        );
      }
    }
    removeNextUnreadButtons(document, kept);
  }

  function sync(): void {
    const stops = readStops(document);
    markUnreadGroups(
      document,
      stops.map((stop) => stop.comments),
    );
    syncNextUnreadButtons(stops);
    const firstUnread = findOrAddFirstUnreadButton(document, () => {
      void goTo(readStops(document)[0]);
    });
    if (firstUnread !== null && firstUnread.disabled !== (stops.length === 0)) {
      firstUnread.disabled = stops.length === 0;
    }
  }

  return { sync };
}

export { createUnreadComments };
