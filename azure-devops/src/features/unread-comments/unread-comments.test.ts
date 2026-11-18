import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createUnreadComments } from "./unread-comments.ts";
import { test } from "node:test";

/** A comment, with Azure DevOps's unread dot before its time when it is unread. */
function comment(isUnread: boolean): string {
  const marker = isUnread ? '<div class="repos-unread-comment-marker"></div>' : "";
  return `<div class="repos-comment-viewer"><div class="repos-discussion-comment-header flex-row">
    <div class="scroll-hidden flex-row flex-center"><span>Quill Barrow</span><div>${marker}<time>an hour ago</time></div></div>
  </div><p>Should the total include tax?</p></div>`;
}

/** A row with a thread, one comment per entry: true for unread. */
function threadRow(comments: boolean[], isNew = false): string {
  return `<tr class="bolt-timeline-row"><td>
    <div class="activity-feed-sequence${isNew ? " new" : ""} bolt-timeline-sequence"></div>
    <div class="repos-discussion-thread">${comments.map((isUnread) => comment(isUnread)).join("")}</div></td></tr>`;
}

/** A row with a thread Azure DevOps has not rendered yet: the thread is there, its comments not. */
function unrenderedThreadRow(isNew: boolean): string {
  return `<tr class="bolt-timeline-row"><td>
    <div class="activity-feed-sequence${isNew ? " new" : ""} bolt-timeline-sequence"></div>
    <div class="repos-discussion-thread"></div></td></tr>`;
}

/** A new row that is no comment, such as a push. */
const newPushRow = `<tr class="bolt-timeline-row"><td>
  <div class="activity-feed-sequence new bolt-timeline-sequence"></div><p>pushed 1 commit</p></td></tr>`;

/**
 * No layout in jsdom: a comment counts as shown unless a collapsed thread hides it, as
 * collapsible-threads does with every comment but the first.
 */
function isShownWithoutLayout(this: Element): boolean {
  return (
    this.closest('[data-fix-ado-thread="collapsed"]') === null ||
    this.previousElementSibling === null
  );
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  /** The mark of every comment, in DOM order. */
  marks: () => (string | undefined)[];
  firstUnreadButton: () => HTMLButtonElement | null;
  nextUnreadButtons: () => HTMLButtonElement[];
  /** The elements scrolled to, in order. */
  scrolledTo: Element[];
}

function overviewPage(
  rows: string,
  order: "newest-first" | "oldest-first" = "newest-first",
): OverviewPage {
  const orderMark = order === "oldest-first" ? ' data-fix-ado-activity-order="oldest-first"' : "";
  const html = `<div class="flex-row"><div class="repos-activity-filter-dropdown"><button>All activity</button></div></div>
    <table class="activity-feed-list"${orderMark}><tbody>${rows}</tbody></table>`;
  const { window } = new JSDOM(`<!doctype html><body>${html}</body>`);
  const scrolledTo: Element[] = [];
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: Element): void {
    scrolledTo.push(this);
  };
  window.HTMLElement.prototype.checkVisibility = isShownWithoutLayout;
  const { document } = window;
  const { sync } = createUnreadComments({ document });
  return {
    document,
    firstUnreadButton: () => document.querySelector(".fix-ado-first-unread"),
    marks: () =>
      [...document.querySelectorAll<HTMLElement>(".repos-comment-viewer")].map(
        (viewer) => viewer.dataset.fixAdoUnread,
      ),
    nextUnreadButtons: () => [
      ...document.querySelectorAll<HTMLButtonElement>(".fix-ado-next-unread"),
    ],
    scrolledTo,
    sync,
  };
}

/** Lets the click handler finish its awaited scroll. */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

test("unread comments that follow each other in a thread form one group", () => {
  const page = overviewPage(threadRow([false, true, true, true, false, true]) + threadRow([true]));
  page.sync();
  assert.deepEqual(page.marks(), [undefined, "first", "middle", "last", undefined, "only", "only"]);
});

test("a comment that is no longer unread loses its mark", () => {
  const page = overviewPage(threadRow([true, true]));
  page.sync();
  page.document.querySelector(".repos-unread-comment-marker")?.remove();
  page.sync();
  assert.deepEqual(page.marks(), [undefined, "only"]);
});

test("Go to first unread is in the bar above the feed, and disabled without unread comments", () => {
  const page = overviewPage(threadRow([false]));
  page.sync();
  page.sync();
  const button = page.firstUnreadButton();
  assert.equal(button?.textContent, "Go to first unread");
  assert.equal(button?.disabled, true);
  assert.equal(page.document.querySelectorAll(".fix-ado-first-unread").length, 1);
  assert.ok(
    button?.closest(".flex-row")?.querySelector(".repos-activity-filter-dropdown") !== null,
  );
});

test("Go to first unread scrolls to the first group and moves focus there", async () => {
  const page = overviewPage(threadRow([false, true]) + threadRow([true]));
  page.sync();
  const button = page.firstUnreadButton();
  assert.equal(button?.disabled, false);
  button?.click();
  await settle();
  const [, firstGroup] = page.document.querySelectorAll(".repos-comment-viewer");
  assert.deepEqual(page.scrolledTo, [firstGroup]);
  assert.equal(page.document.activeElement, firstGroup);
});

test("every group but the last has Go to next unread after the time of its first comment", () => {
  const page = overviewPage(threadRow([true, true, false, true]) + threadRow([true]));
  page.sync();
  page.sync();
  const buttons = page.nextUnreadButtons();
  assert.equal(buttons.length, 2);
  const viewers = page.document.querySelectorAll(".repos-comment-viewer");
  assert.equal(buttons[0]?.closest(".repos-comment-viewer"), viewers[0]);
  assert.equal(buttons[1]?.closest(".repos-comment-viewer"), viewers[3]);
  assert.equal(buttons[0]?.previousElementSibling?.tagName, "TIME");
  assert.equal(buttons[0]?.textContent, "Go to next unread");
});

test("Go to next unread scrolls to the next group", async () => {
  const page = overviewPage(threadRow([true, false, true]));
  page.sync();
  page.nextUnreadButtons()[0]?.click();
  await settle();
  assert.deepEqual(page.scrolledTo, [page.document.querySelectorAll(".repos-comment-viewer")[2]]);
});

test("a new thread Azure DevOps has not rendered yet is a stop; a new push or an old thread is not", async () => {
  const page = overviewPage(
    newPushRow + threadRow([true]) + unrenderedThreadRow(false) + unrenderedThreadRow(true),
  );
  page.sync();
  page.nextUnreadButtons()[0]?.click();
  await settle();
  assert.deepEqual(page.scrolledTo, [page.document.querySelectorAll(".bolt-timeline-row")[3]]);
});

test("with oldest first, the order of the stops follows the feed as shown", async () => {
  const page = overviewPage(threadRow([true]) + threadRow([true]), "oldest-first");
  page.sync();
  page.firstUnreadButton()?.click();
  await settle();
  const viewers = page.document.querySelectorAll(".repos-comment-viewer");
  assert.deepEqual(page.scrolledTo, [viewers[1]]);
  assert.equal(
    viewers[1]?.querySelector(".fix-ado-next-unread"),
    viewers[1]?.querySelector("button"),
  );
  assert.equal(viewers[0]?.querySelector(".fix-ado-next-unread"), null);
});

test("a group that is no longer unread loses its Go to next unread", () => {
  const page = overviewPage(threadRow([true]) + threadRow([true]));
  page.sync();
  for (const marker of page.document.querySelectorAll(".repos-unread-comment-marker")) {
    marker.remove();
  }
  page.sync();
  assert.equal(page.nextUnreadButtons().length, 0);
  assert.equal(page.firstUnreadButton()?.disabled, true);
});

test("in a thread the owner collapsed, Go to first unread scrolls to the thread", async () => {
  const page = overviewPage(threadRow([false, true]));
  page.sync();
  const thread = page.document.querySelector<HTMLElement>(".repos-discussion-thread");
  assert.ok(thread !== null);
  thread.dataset.fixAdoThread = "collapsed";
  page.firstUnreadButton()?.click();
  await settle();
  assert.deepEqual(page.scrolledTo, [thread]);
});

test("the scroll leaves room for the tab bar that sticks to the top", async () => {
  const page = overviewPage(threadRow([true]));
  page.document.body.insertAdjacentHTML("afterbegin", '<div class="bolt-tabbar sticky"></div>');
  Object.defineProperty(page.document.defaultView?.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement): number {
      return this.classList.contains("bolt-tabbar") ? 48 : 0;
    },
  });
  page.sync();
  page.firstUnreadButton()?.click();
  await settle();
  const feed = page.document.querySelector<HTMLElement>(".activity-feed-list");
  assert.equal(feed?.style.getPropertyValue("--fix-ado-sticky-height"), "48px");
});
