import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import { test } from "node:test";

const threadStates = (document: Document): (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>(".activity-feed-list .repos-discussion-thread")].map(
    (thread) => thread.dataset.fixAdoThread,
  );

test(
  "the captured threads are open with a toggle each; the one still loading is left alone",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-duplicate-error");
    const { sync } = createCollapsibleThreads({ document });
    sync();
    sync();
    assert.deepEqual(threadStates(document), ["open", "open", undefined]);
    assert.equal(document.querySelectorAll(".fix-ado-thread-toggle").length, 2);
  },
);

test(
  "a captured thread whose status reads Resolved is collapsed, and its toggle opens it",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-duplicate-error");
    const status = document.querySelector(
      ".repos-discussion-thread .bolt-dropdown-expandable-button-label",
    );
    assert.ok(status !== null);
    status.textContent = "Resolved";
    const { sync } = createCollapsibleThreads({ document });
    sync();
    assert.deepEqual(threadStates(document), ["collapsed", "open", undefined]);
    document.querySelector<HTMLElement>(".fix-ado-thread-toggle")?.click();
    assert.deepEqual(threadStates(document), ["open", "open", undefined]);
  },
);

test(
  "a captured file thread has its file header right before it, where the collapsed style hides it",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-warnings");
    createCollapsibleThreads({ document }).sync();
    const thread = document.querySelector("[data-fix-ado-thread]");
    const fileHeader = thread?.previousElementSibling;
    assert.ok(fileHeader?.classList.contains("comment-file-header") === true);
  },
);

test(
  "in the captured narrow Overview, an open thread on a file has its toggle before the file's icon",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-small");
    document.querySelector(".fix-ado-thread-toggle")?.remove();
    createCollapsibleThreads({ document }).sync();
    const toggle = document.querySelector(".fix-ado-thread-toggle");
    assert.ok(toggle?.parentElement?.classList.contains("comment-file-header-title") === true);
    assert.equal(toggle.previousElementSibling, null);
  },
);

test(
  "the captured Overview gets an Expand all threads button in the bar above its feed",
  { skip: fixtures.skipWithout("pr-detail.html") },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail");
    createCollapsibleThreads({ document }).sync();
    const button = document.querySelector(".fix-ado-expand-all-threads");
    const bar = button?.parentElement?.parentElement;
    assert.ok(bar?.nextElementSibling?.classList.contains("activity-feed-list") === true);
  },
);

test(
  "a captured resolved thread with an unread comment stays open",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-warnings");
    const marker = document.querySelector(".repos-unread-comment-marker");
    const status = marker
      ?.closest(".repos-discussion-thread")
      ?.querySelector(".bolt-dropdown-expandable-button-label");
    assert.ok(status !== null && status !== undefined);
    status.textContent = "Resolved";
    createCollapsibleThreads({ document }).sync();
    assert.equal(
      marker?.closest<HTMLElement>("[data-fix-ado-thread]")?.dataset.fixAdoThread,
      "open",
    );
  },
);

test(
  "a captured thread with its reply field clicked has a textarea without the thread's id",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-reply-focused");
    const fields = [
      ...document.querySelectorAll(
        ".activity-feed-list .repos-discussion-thread-reply :is(input, textarea)",
      ),
    ];
    const textareas = fields.filter((field) => field.matches("textarea"));
    const inputs = fields.filter((field) => field.matches("input"));
    assert.ok(textareas.length > 0);
    assert.ok(textareas.every((textarea) => !textarea.className.includes("threadId-")));
    assert.ok(inputs.every((input) => /\bthreadId-\d+\b/u.test(input.className)));
  },
);

const clickButton = (document: Document, label: string): void => {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === label,
  );
  assert.ok(button !== undefined, `no ${label} button`);
  assert.equal(button.hidden, false, `${label} is hidden`);
  button.click();
};

test(
  "Collapse all threads collapses the captured active threads, and Collapse done threads opens them again",
  { skip: fixtures.skipWithout("pr-detail-wide.html") },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-wide");
    createCollapsibleThreads({ document }).sync();
    clickButton(document, "Collapse all threads");
    const loaded = (): (string | undefined)[] =>
      threadStates(document).filter((state) => state !== undefined);
    assert.ok(loaded().length >= 2);
    assert.ok(loaded().every((state) => state === "collapsed"));
    clickButton(document, "Collapse done threads");
    assert.ok(loaded().every((state) => state === "open"));
  },
);

test(
  "Collapse done threads collapses the captured resolved threads and keeps the active ones open",
  { skip: fixtures.skipWithout("pr-detail-reply-focused.html") },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-reply-focused");
    createCollapsibleThreads({ document }).sync();
    clickButton(document, "Expand all threads");
    clickButton(document, "Collapse done threads");
    const statesByStatus = [
      ...document.querySelectorAll<HTMLElement>(".activity-feed-list [data-fix-ado-thread]"),
    ].map((thread) => [
      thread.querySelector(".bolt-dropdown-expandable-button-label")?.textContent.trim(),
      thread.dataset.fixAdoThread,
    ]);
    assert.ok(statesByStatus.some(([status]) => status === "Resolved"));
    for (const [status, state] of statesByStatus) {
      assert.equal(state, status === "Resolved" ? "collapsed" : "open");
    }
  },
);
