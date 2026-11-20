import { overviewPage, thread } from "./collapsible-threads.test-page.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import { test } from "node:test";

test("a done thread starts collapsed, an active or pending one or one without a status starts open", () => {
  const page = overviewPage(
    thread(11, "Resolved") +
      thread(12, "Active") +
      thread(13, "Closed") +
      thread(14, "Pending") +
      thread(15, "Won’t fix") +
      thread(16, ""),
  );
  page.sync();
  assert.deepEqual(page.states(), ["collapsed", "open", "collapsed", "open", "collapsed", "open"]);
});

test("a done thread other than resolved with an unread comment starts open", () => {
  const page = overviewPage(thread(11, "Parked", { isReplyUnread: true }));
  page.sync();
  assert.deepEqual(page.states(), ["open"]);
});

test("a resolved thread with an unread comment starts open, and opens when one comes in", () => {
  const page = overviewPage(
    thread(11, "Resolved", { isReplyUnread: true }) + thread(12, "Resolved"),
  );
  page.sync();
  assert.deepEqual(page.states(), ["open", "collapsed"]);
  page.document
    .querySelectorAll(".repos-discussion-comment-header time")[3]
    ?.insertAdjacentHTML("beforebegin", '<div class="repos-unread-comment-marker"></div>');
  page.sync();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("a resolved thread with an unread comment the owner collapsed stays collapsed", () => {
  const page = overviewPage(thread(11, "Resolved", { isReplyUnread: true }));
  page.sync();
  page.toggles()[0]?.click();
  assert.deepEqual(page.states(), ["collapsed"]);
});

test("every thread has one toggle, before the author of its first comment", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.sync();
  const [collapsed, open] = page.toggles();
  assert.equal(page.toggles().length, 2);
  assert.equal(collapsed?.getAttribute("aria-expanded"), "false");
  assert.equal(collapsed?.title, "Expand thread");
  assert.equal(open?.getAttribute("aria-expanded"), "true");
  assert.equal(open?.title, "Collapse thread");
  for (const toggle of [collapsed, open]) {
    assert.ok(toggle?.nextElementSibling?.querySelector(".repos-comment-header-persona") !== null);
    assert.equal(toggle?.closest(".repos-comment-viewer")?.previousElementSibling, null);
  }
});

test("an open thread on a file has its toggle before the file's icon, a collapsed one before the author", () => {
  const page = overviewPage(thread(11, "Active", { isOnFile: true }));
  page.sync();
  const [toggle] = page.toggles();
  assert.equal(toggle?.parentElement?.className, "comment-file-header-title flex-row");
  assert.equal(toggle?.nextElementSibling?.className, "file-icon");
  toggle?.click();
  assert.deepEqual(page.states(), ["collapsed"]);
  assert.ok(toggle?.nextElementSibling?.querySelector(".repos-comment-header-persona") !== null);
  toggle?.click();
  assert.equal(toggle?.nextElementSibling?.className, "file-icon");
  assert.equal(page.toggles().length, 1);
});

test("a click on the toggle collapses an open thread and opens a collapsed one", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[0]?.click();
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["open", "collapsed"]);
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("a thread the owner resolves collapses, and opens again when reactivated", () => {
  const page = overviewPage(thread(12, "Active"));
  page.sync();
  page.setStatus(0, "Resolved");
  page.sync();
  assert.deepEqual(page.states(), ["collapsed"]);
  page.setStatus(0, "Active");
  page.sync();
  assert.deepEqual(page.states(), ["open"]);
});

test("a thread the owner opened or collapsed stays that way, also when Azure DevOps renders it again", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[0]?.click();
  const body = page.document.querySelector("tbody");
  assert.ok(body !== null);
  body.innerHTML = thread(12, "Active") + thread(11, "Resolved");
  page.sync();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("a thread whose first comment is still loading is left alone", () => {
  const loading = `<tr><td><div class="repos-discussion-thread">
    <div class="repos-comment-viewer"><div class="bolt-spinner"></div></div>
    <div class="repos-discussion-thread-reply"><input class="threadId-14"></div>
  </div></td></tr>`;
  const page = overviewPage(loading);
  page.sync();
  assert.deepEqual(page.states(), [undefined]);
  assert.equal(page.toggles().length, 0);
});

test("the bar above the feed gets one Expand all threads button, as its first item", () => {
  const page = overviewPage(thread(11, "Resolved"));
  page.sync();
  page.sync();
  const [button] = page.allThreadsButtons();
  assert.equal(page.allThreadsButtons().length, 1);
  assert.equal(button?.textContent, "Expand all threads");
  const bar = page.document.querySelector(".repos-activity-filter-dropdown")?.parentElement;
  assert.ok(bar?.firstElementChild?.contains(button ?? null) === true);
});

test("Expand all threads opens every thread, also one the owner collapsed", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "collapsed"]);
  page.clickBulkButton("Expand all threads");
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("after Expand all threads, a resolved thread that renders later opens too", () => {
  const page = overviewPage(thread(11, "Resolved"));
  page.sync();
  page.allThreadsButtons()[0]?.click();
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(12, "Resolved"));
  page.sync();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("after Expand all threads, the owner can still collapse one thread", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[1]?.click();
  page.clickBulkButton("Expand all threads");
  page.toggles()[0]?.click();
  assert.deepEqual(page.states(), ["collapsed", "open"]);
});

test("a page without the bar above the feed gets no bulk buttons", () => {
  const { document } = new JSDOM(
    `<!doctype html><body><table class="activity-feed-list"><tbody>${thread(11, "Resolved")}</tbody></table></body>`,
  ).window;
  createCollapsibleThreads({ document }).sync();
  assert.equal(document.querySelector(".fix-ado-all-threads-button"), null);
});

/** Clicking a reply field swaps its input for a textarea without the thread's id class. */
function focusReplies(document: Document): void {
  for (const input of document.querySelectorAll(".repos-discussion-thread-reply input")) {
    const textarea = document.createElement("textarea");
    textarea.className = "bolt-textfield-input flex-grow bolt-textfield-auto-adjust";
    input.replaceWith(textarea);
  }
}

test("a thread with its reply field clicked keeps its state, and its toggle still works", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[0]?.click();
  assert.deepEqual(page.states(), ["open", "open"]);
  focusReplies(page.document);
  page.sync();
  assert.deepEqual(page.states(), ["open", "open"]);
  page.toggles()[0]?.click();
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "collapsed"]);
});
