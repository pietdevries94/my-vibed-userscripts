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
  "in the captured narrow Overview, a toggle sits beside the time, not on a line of its own",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-small");
    document.querySelector(".fix-ado-thread-toggle")?.remove();
    createCollapsibleThreads({ document }).sync();
    const toggle = document.querySelector(".fix-ado-thread-toggle");
    assert.ok(toggle?.parentElement?.querySelector("time") !== null);
    assert.ok(toggle?.parentElement?.classList.contains("flex-row") === true);
  },
);
