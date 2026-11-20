import { overviewPage, thread } from "./collapsible-threads.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the bar above the feed gets Expand all threads, Collapse all threads and Collapse done threads, in that order, once", () => {
  const page = overviewPage(thread(11, "Resolved"));
  page.sync();
  page.sync();
  const bar = page.document.querySelector(".repos-activity-filter-dropdown")?.parentElement;
  const labels = [...(bar?.firstElementChild?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent,
  );
  assert.deepEqual(labels, ["Expand all threads", "Collapse all threads", "Collapse done threads"]);
});

test("Collapse all threads collapses every thread, also an active one, one with an unread comment and one the owner opened", () => {
  const page = overviewPage(
    thread(11, "Resolved") + thread(12, "Active") + thread(13, "Pending", { isReplyUnread: true }),
  );
  page.sync();
  page.toggles()[0]?.click();
  assert.deepEqual(page.states(), ["open", "open", "open"]);
  page.clickBulkButton("Collapse all threads");
  assert.deepEqual(page.states(), ["collapsed", "collapsed", "collapsed"]);
});

test("after Collapse all threads, an active thread that renders later collapses too, and the owner can still open one", () => {
  const page = overviewPage(thread(11, "Active"));
  page.sync();
  page.clickBulkButton("Collapse all threads");
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(12, "Active"));
  page.sync();
  assert.deepEqual(page.states(), ["collapsed", "collapsed"]);
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "open"]);
});

test("Collapse done threads collapses done ones, also with an unread comment, and opens active and pending ones", () => {
  const page = overviewPage(
    thread(11, "Resolved", { isReplyUnread: true }) +
      thread(12, "Parked") +
      thread(13, "Active") +
      thread(14, "Pending") +
      thread(15, "Closed", { isReplyUnread: true }),
  );
  page.sync();
  page.clickBulkButton("Collapse all threads");
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "open", "collapsed", "collapsed", "collapsed"]);
  page.clickBulkButton("Collapse done threads");
  assert.deepEqual(page.states(), ["collapsed", "collapsed", "open", "open", "collapsed"]);
});

test("after Collapse done threads, threads that render later follow it, and Expand all threads opens them all", () => {
  const page = overviewPage(thread(11, "Resolved", { isReplyUnread: true }));
  page.sync();
  page.clickBulkButton("Collapse done threads");
  page.document
    .querySelector("tbody")
    ?.insertAdjacentHTML(
      "beforeend",
      thread(12, "Resolved", { isReplyUnread: true }) + thread(13, "Active"),
    );
  page.sync();
  assert.deepEqual(page.states(), ["collapsed", "collapsed", "open"]);
  page.clickBulkButton("Expand all threads");
  assert.deepEqual(page.states(), ["open", "open", "open"]);
});

test("each bulk button shows only while it would change a thread", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Expand all threads", "Collapse all threads"]);
  page.clickBulkButton("Collapse all threads");
  assert.deepEqual(page.shownBulkButtons(), ["Expand all threads", "Collapse done threads"]);
  page.clickBulkButton("Expand all threads");
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads", "Collapse done threads"]);
  page.clickBulkButton("Collapse done threads");
  assert.deepEqual(page.shownBulkButtons(), ["Expand all threads", "Collapse all threads"]);
});

test("an open done thread other than resolved shows Collapse done threads", () => {
  const page = overviewPage(thread(11, "Parked", { isReplyUnread: true }) + thread(12, "Active"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads", "Collapse done threads"]);
});

test("a thread toggle and a thread that renders later update which bulk buttons show", () => {
  const page = overviewPage(thread(12, "Active"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads"]);
  page.toggles()[0]?.click();
  assert.deepEqual(page.shownBulkButtons(), ["Expand all threads", "Collapse done threads"]);
  page.toggles()[0]?.click();
  page.document
    .querySelector("tbody")
    ?.insertAdjacentHTML("beforeend", thread(13, "Resolved", { isReplyUnread: true }));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads", "Collapse done threads"]);
});

test("with no thread to change, every bulk button and their box are hidden", () => {
  const loading = `<tr><td><div class="repos-discussion-thread">
    <div class="repos-comment-viewer"><div class="bolt-spinner"></div></div>
  </div></td></tr>`;
  const page = overviewPage(loading);
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), []);
  const box = page.document.querySelector<HTMLElement>(".fix-ado-thread-bulk-buttons");
  assert.equal(box?.hidden, true);
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(12, "Active"));
  page.sync();
  assert.equal(box?.hidden, false);
});
