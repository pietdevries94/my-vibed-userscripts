// The buttons above the feed of a pull request's Overview that collapse or expand many threads at once.
import type { FeedThread } from "../../pull-requests/feed-threads.ts";
import type { ThreadState } from "./collapsible-threads.ts";

/** The feed's filter, in the bar above the feed. */
const FILTER_SELECTOR = ".repos-activity-filter-dropdown";
const BULK_BOX_CLASS = "fix-ado-thread-bulk-buttons";

/** The threads a button above the feed acts on: every thread, or the done ones. */
type ThreadGroup = "all" | "done";

interface BulkButton {
  group: ThreadGroup;
  className: string;
  labels: { collapse: string; expand: string };
}

const BULK_BUTTONS: BulkButton[] = [
  {
    className: "fix-ado-all-threads-button",
    group: "all",
    labels: { collapse: "Collapse all threads", expand: "Expand all threads" },
  },
  {
    className: "fix-ado-done-threads-button",
    group: "done",
    labels: { collapse: "Collapse done threads", expand: "Expand done threads" },
  },
];

/**
 * The state the last bulk click gave done threads and the other ones, also the ones Azure
 * DevOps renders later, until a reload. Null for a group no click has set.
 */
interface GroupStates {
  done: ThreadState | null;
  other: ThreadState | null;
}

const isEveryCollapsed = (feedThreads: FeedThread[]): boolean =>
  feedThreads.length > 0 &&
  feedThreads.every((feedThread) => feedThread.thread.dataset.fixAdoThread === "collapsed");

const doneThreadsOf = (feedThreads: FeedThread[]): FeedThread[] =>
  feedThreads.filter((feedThread) => feedThread.isDone);

/**
 * The group states after a click. Expand all and Collapse all set both groups. Collapse done
 * collapses done threads and opens the others; Expand done opens done threads only.
 */
function groupStatesAfter(
  group: ThreadGroup,
  feedThreads: FeedThread[],
  current: GroupStates,
): GroupStates {
  if (group === "all") {
    const state = isEveryCollapsed(feedThreads) ? "open" : "collapsed";
    return { done: state, other: state };
  }
  if (isEveryCollapsed(doneThreadsOf(feedThreads))) {
    return { ...current, done: "open" };
  }
  return { done: "collapsed", other: "open" };
}

function createBulkButton(
  document: Document,
  { className, group, labels }: BulkButton,
  onClick: (group: ThreadGroup) => void,
): HTMLButtonElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text",
    textContent: labels.collapse,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} bolt-button enabled bolt-focus-treatment`;
  button.append(text);
  button.addEventListener("click", () => {
    onClick(group);
  });
  return button;
}

/**
 * The bulk buttons, in a box with the margins each filter has. Azure DevOps's button style
 * drops a margin on the button itself.
 */
function createBulkBox(document: Document, onClick: (group: ThreadGroup) => void): HTMLElement {
  const box = Object.assign(document.createElement("div"), {
    className: `${BULK_BOX_CLASS} margin-bottom-16 inline-flex-row`,
  });
  box.append(...BULK_BUTTONS.map((bulkButton) => createBulkButton(document, bulkButton, onClick)));
  return box;
}

/** The bulk buttons' box, first in the bar above the feed (style.css puts it left). Null while the bar is not there. */
function findOrAddBulkBox(
  document: Document,
  onClick: (group: ThreadGroup) => void,
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

/** Sets a button's text only when it changes, to keep the page's mutation observer quiet. */
function setLabel(button: HTMLElement, label: string): void {
  const text = button.querySelector(".bolt-button-text");
  if (text !== null && text.textContent !== label) {
    text.textContent = label;
  }
}

/**
 * Each button reads Collapse until every thread of its group is collapsed, then Expand. The
 * done button hides while no thread is done.
 */
function showBulkButtons(box: HTMLElement, feedThreads: FeedThread[]): void {
  for (const { className, group, labels } of BULK_BUTTONS) {
    const button = box.querySelector<HTMLElement>(`.${className}`);
    const groupThreads = group === "all" ? feedThreads : doneThreadsOf(feedThreads);
    if (button !== null) {
      setLabel(button, isEveryCollapsed(groupThreads) ? labels.expand : labels.collapse);
      setHidden(button, group === "done" && groupThreads.length === 0);
    }
  }
}

export type { ThreadGroup, GroupStates };
export { doneThreadsOf, findOrAddBulkBox, groupStatesAfter, isEveryCollapsed, showBulkButtons };
