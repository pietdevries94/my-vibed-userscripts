import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createCollapsibleThreads } from "./collapsible-threads.ts";
import { test } from "node:test";

function comment(author: string, status: string | null): string {
  const statusDropdown =
    status === null
      ? ""
      : `<div class="bolt-dropdown-expandable"><button><div class="bolt-dropdown-expandable-button-label">${status}</div></button></div>`;
  return `<div class="repos-comment-viewer"><div class="repos-discussion-comment"><div class="flex-column"><div class="flex-row">
    <div><div class="bolt-coin repos-comment-header-persona"></div></div>
    <div class="repos-comment-editor-fit flex-column">
      <div class="repos-discussion-comment-header flex-row">
        <div class="scroll-hidden flex-row flex-center"><span>${author}</span><div><time>an hour ago</time></div></div>
        <div class="flex-row justify-end">${statusDropdown}</div>
      </div><p>Should the total include tax?</p>
    </div>
  </div></div></div></div>`;
}

/**
 * A thread of two comments with its reply box. Only the first comment has the status dropdown.
 * A thread on a file has the file's header before it.
 */
function thread(threadId: number, status: string, isOnFile = false): string {
  const fileHeader = isOnFile
    ? `<div class="comment-file-header"><div class="comment-file-header-title flex-row">
        <div class="file-icon"></div><a>invoice.ts</a></div></div>`
    : "";
  return `<tr class="bolt-timeline-row"><td>${fileHeader}<div class="repos-discussion-thread">
    ${comment("Quill Barrow", status)}${comment("Marren Tolk", null)}
    <div class="repos-discussion-thread-reply"><input class="threadId-${threadId} bolt-textfield-input"></div>
  </div></td></tr>`;
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  states: () => (string | undefined)[];
  toggles: () => HTMLButtonElement[];
  expandAllButtons: () => HTMLButtonElement[];
  setStatus: (index: number, status: string) => void;
}

function overviewPage(rows: string): OverviewPage {
  const html = `<div class="flex-row flex-wrap justify-end">
      <div class="margin-bottom-16 margin-right-8 bolt-dropdown-expandable"><button>Active</button></div>
      <div class="repos-activity-filter-dropdown bolt-dropdown-expandable"><button>All activity</button></div>
    </div>
    <table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createCollapsibleThreads({ document });
  return {
    document,
    expandAllButtons: () => [
      ...document.querySelectorAll<HTMLButtonElement>(".fix-ado-expand-all-threads"),
    ],
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
  const page = overviewPage(thread(11, "Active", true));
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
  const [button] = page.expandAllButtons();
  assert.equal(page.expandAllButtons().length, 1);
  assert.equal(button?.textContent, "Expand all threads");
  const bar = page.document.querySelector(".repos-activity-filter-dropdown")?.parentElement;
  assert.ok(bar?.firstElementChild?.contains(button ?? null) === true);
});

test("Expand all threads opens every thread, also one the owner collapsed", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["collapsed", "collapsed"]);
  page.expandAllButtons()[0]?.click();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("after Expand all threads, a resolved thread that renders later opens too", () => {
  const page = overviewPage(thread(11, "Resolved"));
  page.sync();
  page.expandAllButtons()[0]?.click();
  page.document.querySelector("tbody")?.insertAdjacentHTML("beforeend", thread(12, "Resolved"));
  page.sync();
  assert.deepEqual(page.states(), ["open", "open"]);
});

test("after Expand all threads, the owner can still collapse one thread", () => {
  const page = overviewPage(thread(11, "Resolved") + thread(12, "Active"));
  page.sync();
  page.expandAllButtons()[0]?.click();
  page.toggles()[0]?.click();
  assert.deepEqual(page.states(), ["collapsed", "open"]);
});

test("a page without the bar above the feed gets no Expand all threads button", () => {
  const { document } = new JSDOM(
    `<!doctype html><body><table class="activity-feed-list"><tbody>${thread(11, "Resolved")}</tbody></table></body>`,
  ).window;
  createCollapsibleThreads({ document }).sync();
  assert.equal(document.querySelector(".fix-ado-expand-all-threads"), null);
});
