import { overviewPage, thread } from "./collapsible-threads.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the bar above the feed gets the all and done buttons first, once", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.sync();
  const bar = page.document.querySelector(".repos-activity-filter-dropdown")?.parentElement;
  const labels = [...(bar?.firstElementChild?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent,
  );
  assert.deepEqual(labels, ["Collapse all threads", "Expand done threads"]);
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
  const page = overviewPage(thread(11, "Active") + thread(12, "Active"));
  page.sync();
  page.clickBulkButton("Collapse all threads");
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(13, "Active"));
  page.sync();
  assert.deepEqual(page.states(), ["collapsed", "collapsed", "collapsed"]);
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "open", "collapsed"]);
});

test("the all button reads Collapse all threads until every thread is collapsed, then Expand all threads", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons()[0], "Collapse all threads");
  page.toggles()[1]?.click();
  assert.deepEqual(page.shownBulkButtons()[0], "Expand all threads");
  page.clickBulkButton("Expand all threads");
  assert.deepEqual(page.states(), ["open", "open"]);
  assert.deepEqual(page.shownBulkButtons()[0], "Collapse all threads");
});

test("with no loaded thread, the all button reads Collapse all threads and the done button hides", () => {
  const loading = `<tr><td><div class="repos-discussion-thread">
    <div class="repos-comment-viewer"><div class="bolt-spinner"></div></div>
  </div></td></tr>`;
  const page = overviewPage(loading);
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads"]);
});

test("the done button hides while no thread is done, and shows when one renders", () => {
  const page = overviewPage(thread(11, "Active") + thread(12, "Pending"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads"]);
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(13, "Closed"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads", "Expand done threads"]);
});

test("the done button reads Collapse done threads until every done thread is collapsed, then Expand done threads", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Parked") + thread(13, "Active"));
  page.sync();
  assert.deepEqual(page.shownBulkButtons()[1], "Expand done threads");
  page.toggles()[0]?.click();
  assert.deepEqual(page.shownBulkButtons()[1], "Collapse done threads");
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
  assert.deepEqual(page.shownBulkButtons(), ["Collapse all threads", "Expand done threads"]);
});

test("Expand done threads opens done ones and leaves active and pending ones as they are", () => {
  const page = overviewPage(
    thread(11, "Resolved") + thread(12, "Closed") + thread(13, "Active") + thread(14, "Pending"),
  );
  page.sync();
  page.toggles()[3]?.click();
  assert.deepEqual(page.states(), ["collapsed", "collapsed", "open", "collapsed"]);
  page.clickBulkButton("Expand done threads");
  assert.deepEqual(page.states(), ["open", "open", "open", "collapsed"]);
  assert.deepEqual(page.shownBulkButtons()[1], "Collapse done threads");
});

test("after Collapse all threads, Expand done threads opens the done ones and keeps the others collapsed, also ones that render later", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.clickBulkButton("Collapse all threads");
  page.clickBulkButton("Expand done threads");
  page.document
    .querySelector("tbody")
    ?.insertAdjacentHTML("beforeend", thread(13, "Resolved") + thread(14, "Active"));
  page.sync();
  assert.deepEqual(page.states(), ["open", "collapsed", "open", "collapsed"]);
});

test("after Collapse done threads, threads that render later follow it", () => {
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
});
