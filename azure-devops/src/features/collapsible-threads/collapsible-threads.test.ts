import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import { test } from "node:test";

function comment(author: string, status: string | null): string {
  const statusDropdown =
    status === null
      ? ""
      : `<div class="bolt-dropdown-expandable"><button><div class="bolt-dropdown-expandable-button-label">${status}</div></button></div>`;
  return `<div class="repos-comment-viewer"><div class="repos-discussion-comment-header flex-row">
    <div class="scroll-hidden flex-row flex-center"><span>${author}</span><div><time>an hour ago</time></div></div>
    <div class="flex-row justify-end">${statusDropdown}</div>
  </div><p>Should the total include tax?</p></div>`;
}

/** A thread of two comments with its reply box. Only the first comment has the status dropdown. */
function thread(threadId: number, status: string): string {
  return `<tr class="bolt-timeline-row"><td><div class="repos-discussion-thread">
    ${comment("Quill Barrow", status)}${comment("Marren Tolk", null)}
    <div class="repos-discussion-thread-reply"><input class="threadId-${threadId} bolt-textfield-input"></div>
  </div></td></tr>`;
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  states: () => (string | undefined)[];
  toggles: () => HTMLButtonElement[];
  setStatus: (index: number, status: string) => void;
}

function overviewPage(rows: string): OverviewPage {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createCollapsibleThreads({ document });
  return {
    document,
    setStatus: (index, status) => {
      const label = document.querySelectorAll(".bolt-dropdown-expandable-button-label")[index];
      assert.ok(label !== undefined);
      label.textContent = status;
    },
    states: () =>
      [...document.querySelectorAll<HTMLElement>(".repos-discussion-thread")].map(
        (shown) => shown.dataset.fixAdoThread,
      ),
    sync,
    toggles: () => [...document.querySelectorAll<HTMLButtonElement>(".fix-ado-thread-toggle")],
  };
}

test("a resolved thread starts collapsed, any other thread starts open", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active") + thread(13, "Closed"));
  page.sync();
  assert.deepEqual(page.states(), ["collapsed", "open", "open"]);
});

test("every thread has one toggle, in the header of its first comment", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.sync();
  const [collapsed, open] = page.toggles();
  assert.equal(page.toggles().length, 2);
  assert.equal(collapsed?.getAttribute("aria-expanded"), "false");
  assert.equal(collapsed?.title, "Expand thread");
  assert.equal(open?.getAttribute("aria-expanded"), "true");
  assert.equal(open?.title, "Collapse thread");
  const header = collapsed?.closest(".repos-discussion-comment-header");
  assert.equal(header?.closest(".repos-comment-viewer")?.previousElementSibling, null);
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
