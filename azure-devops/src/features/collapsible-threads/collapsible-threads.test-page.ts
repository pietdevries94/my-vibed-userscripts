// A pull request's Overview with invented threads, for the collapsible threads tests.
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createCollapsibleThreads } from "./collapsible-threads.ts";

function comment(author: string, status: string | null, isUnread = false): string {
  const statusDropdown =
    status === null
      ? ""
      : `<div class="bolt-dropdown-expandable"><button><div class="bolt-dropdown-expandable-button-label">${status}</div></button></div>`;
  return `<div class="repos-comment-viewer"><div class="repos-discussion-comment"><div class="flex-column"><div class="flex-row">
    <div><div class="bolt-coin repos-comment-header-persona"></div></div>
    <div class="repos-comment-editor-fit flex-column">
      <div class="repos-discussion-comment-header flex-row">
        <div class="scroll-hidden flex-row flex-center"><span>${author}</span><div>${isUnread ? '<div class="repos-unread-comment-marker"></div>' : ""}<time>an hour ago</time></div></div>
        <div class="flex-row justify-end">${statusDropdown}</div>
      </div><p>Should the total include tax?</p>
    </div>
  </div></div></div></div>`;
}

/**
 * A thread of two comments with its reply box. Only the first comment has the status dropdown.
 * A thread on a file has the file's header before it. Its reply can carry Azure DevOps's unread
 * marker.
 */
function thread(
  threadId: number,
  status: string,
  { isOnFile = false, isReplyUnread = false }: { isOnFile?: boolean; isReplyUnread?: boolean } = {},
): string {
  const fileHeader = isOnFile
    ? `<div class="comment-file-header"><div class="comment-file-header-title flex-row">
        <div class="file-icon"></div><a>invoice.ts</a></div></div>`
    : "";
  return `<tr class="bolt-timeline-row"><td>${fileHeader}<div class="repos-discussion-thread">
    ${comment("Quill Barrow", status)}${comment("Marren Tolk", null, isReplyUnread)}
    <div class="repos-discussion-thread-reply"><input class="threadId-${threadId} bolt-textfield-input"></div>
  </div></td></tr>`;
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  states: () => (string | undefined)[];
  toggles: () => HTMLButtonElement[];
  expandAllButtons: () => HTMLButtonElement[];
  clickBulkButton: (label: string) => void;
  shownBulkButtons: () => (string | null)[];
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
    clickBulkButton: (label) => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent === label,
      );
      assert.ok(button !== undefined, `no ${label} button`);
      assert.equal(button.hidden, false, `${label} is hidden`);
      button.click();
    },
    document,
    expandAllButtons: () => [
      ...document.querySelectorAll<HTMLButtonElement>(".fix-ado-expand-all-threads"),
    ],
    setStatus: (index, status) => {
      const label = document.querySelectorAll(".bolt-dropdown-expandable-button-label")[index];
      assert.ok(label !== undefined);
      label.textContent = status;
    },
    shownBulkButtons: () =>
      [...document.querySelectorAll<HTMLButtonElement>(".fix-ado-thread-bulk-buttons button")]
        .filter((button) => button.hidden === false)
        .map((button) => button.textContent),
    states: () =>
      [...document.querySelectorAll<HTMLElement>(".repos-discussion-thread")].map(
        (shown) => shown.dataset.fixAdoThread,
      ),
    sync,
    toggles: () => [...document.querySelectorAll<HTMLButtonElement>(".fix-ado-thread-toggle")],
  };
}

export type { OverviewPage };
export { overviewPage, thread };
