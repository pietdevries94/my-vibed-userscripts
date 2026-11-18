import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createNewActivityChips } from "./new-activity-chips.ts";
import { test } from "node:test";

const sequence = (isNew: boolean): string =>
  `<div class="activity-feed-sequence${isNew ? " new" : ""} bolt-timeline-sequence"></div>`;

/** A line such as a vote, with its time in a box after the words. */
function lineRow(isNew: boolean): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isNew)}
    <div class="activity-card-subtle">Quill Barrow approved</div>
    <div class="flex-row"><span><time>an hour ago</time></span></div></td></tr>`;
}

/** A push, with its time under its title. */
function pushRow(isNew: boolean): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isNew)}
    <a class="iteration-card-header"><span>Fix rounding</span>
    <div class="body-s"><span><time>an hour ago</time></span></div></a></td></tr>`;
}

/** A thread: unread comments glow already, so it gets no chip. */
function threadRow(isNew: boolean): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isNew)}
    <div class="repos-discussion-thread"><span><time>an hour ago</time></span></div></td></tr>`;
}

function overviewPage(rows: string): {
  document: Document;
  sync: () => void;
  chipRows: () => number[];
} {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createNewActivityChips({ document });
  return {
    chipRows: () =>
      [...document.querySelectorAll(".bolt-timeline-row")].flatMap((row, index) =>
        [...row.querySelectorAll(".fix-ado-new-chip")].map(() => index),
      ),
    document,
    sync,
  };
}

test("a new line and a new push get a New chip after their time", () => {
  const page = overviewPage(lineRow(true) + pushRow(true));
  page.sync();
  assert.deepEqual(page.chipRows(), [0, 1]);
  for (const time of page.document.querySelectorAll("time")) {
    assert.equal(time.parentElement?.nextElementSibling?.textContent, "New");
  }
});

test("a row Azure DevOps does not mark as new gets no chip", () => {
  const page = overviewPage(lineRow(false) + pushRow(false));
  page.sync();
  assert.deepEqual(page.chipRows(), []);
});

test("a new thread gets no chip", () => {
  const page = overviewPage(threadRow(true));
  page.sync();
  assert.deepEqual(page.chipRows(), []);
});

test("a second sync adds no second chip", () => {
  const page = overviewPage(pushRow(true));
  page.sync();
  page.sync();
  assert.deepEqual(page.chipRows(), [0]);
});

test("the chip goes when Azure DevOps no longer marks the row as new", () => {
  const page = overviewPage(pushRow(true));
  page.sync();
  page.document.querySelector(".activity-feed-sequence")?.classList.remove("new");
  page.sync();
  assert.deepEqual(page.chipRows(), []);
});
