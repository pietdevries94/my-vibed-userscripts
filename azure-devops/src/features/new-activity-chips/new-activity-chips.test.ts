import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createNewActivityChips } from "./new-activity-chips.ts";
import { createVisitStore } from "./visit-store.ts";
import { test } from "node:test";

const PULL_REQUEST = "example.test/p/r/7";
const OTHER_PULL_REQUEST = "example.test/p/r/8";

interface RowOptions {
  /** Minutes after midnight on 2000-01-01, UTC. */
  minute: number;
  /** True when Azure DevOps flags the row as new itself. */
  isFlagged?: boolean;
}

const at = (minute: number): number => Date.UTC(2000, 0, 1, 0, minute);

const sequence = (isFlagged = false): string =>
  `<div class="activity-feed-sequence${isFlagged ? " new" : ""} bolt-timeline-sequence"></div>`;

const time = (minute: number): string =>
  `<time datetime="${new Date(at(minute)).toISOString()}">an hour ago</time>`;

/** A line such as a vote, with its time in a box after the words. */
function lineRow({ minute, isFlagged }: RowOptions): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isFlagged)}
    <div class="activity-card-subtle">Quill Barrow approved</div>
    <div class="flex-row"><span>${time(minute)}</span></div></td></tr>`;
}

/** A push, with its time under its title. */
function pushRow({ minute, isFlagged }: RowOptions): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isFlagged)}
    <a class="iteration-card-header"><span>Fix rounding</span>
    <div class="body-s"><span>${time(minute)}</span></div></a></td></tr>`;
}

/** A thread: unread comments glow already, so it gets no chip. */
function threadRow({ minute, isFlagged }: RowOptions): string {
  return `<tr class="bolt-timeline-row"><td>${sequence(isFlagged)}
    <div class="repos-discussion-thread"><span>${time(minute)}</span></div></td></tr>`;
}

interface OverviewPage {
  document: Document;
  chips: ReturnType<typeof createNewActivityChips>;
  visits: ReturnType<typeof createVisitStore>;
  /** The index of every row with a chip. */
  chipRows: () => number[];
  setNow: (minute: number) => void;
}

function overviewPage(rows: string, lastVisitMinute: number | null = null): OverviewPage {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const values = new Map<string, unknown>();
  const visits = createVisitStore({
    keys: () => [...values.keys()],
    load: (key) => values.get(key) ?? null,
    remove: (key) => {
      values.delete(key);
    },
    save: (key, visitedAt) => {
      values.set(key, visitedAt);
    },
  });
  if (lastVisitMinute !== null) {
    visits.save(PULL_REQUEST, at(lastVisitMinute));
  }
  let now = at(60);
  const chips = createNewActivityChips({ document, now: () => now, visits });
  return {
    chipRows: () =>
      [...document.querySelectorAll(".bolt-timeline-row")].flatMap((row, index) =>
        [...row.querySelectorAll(".fix-ado-new-chip")].map(() => index),
      ),
    chips,
    document,
    setNow: (minute) => {
      now = at(minute);
    },
    visits,
  };
}

test("a line and a push after the last visit get a New chip after their time", () => {
  const page = overviewPage(lineRow({ minute: 30 }) + pushRow({ minute: 20 }), 10);
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), [0, 1]);
  for (const shown of page.document.querySelectorAll("time")) {
    assert.equal(shown.parentElement?.nextElementSibling?.textContent, "New");
  }
});

test("rows from before the last visit get no chip", () => {
  const page = overviewPage(pushRow({ minute: 30 }) + pushRow({ minute: 5 }), 10);
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), [0]);
});

test("without a saved visit only rows Azure DevOps flags as new get a chip", () => {
  const page = overviewPage(lineRow({ isFlagged: true, minute: 5 }) + pushRow({ minute: 30 }));
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), [0]);
});

test("a thread gets no chip, also when it is newer than the last visit", () => {
  const page = overviewPage(threadRow({ isFlagged: true, minute: 30 }), 10);
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), []);
});

test("a second sync adds no second chip", () => {
  const page = overviewPage(pushRow({ minute: 30 }), 10);
  page.chips.sync(PULL_REQUEST);
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), [0]);
});

test("the chips stay while the owner is on the page, and a push that comes in gets one", () => {
  const page = overviewPage(pushRow({ minute: 30 }), 10);
  page.chips.sync(PULL_REQUEST);
  page.document.querySelector("tbody")?.insertAdjacentHTML("afterbegin", pushRow({ minute: 70 }));
  page.chips.sync(PULL_REQUEST);
  assert.deepEqual(page.chipRows(), [0, 1]);
});

test("leaving saves the visit, so the next visit shows no chip for what was there", () => {
  const page = overviewPage(pushRow({ minute: 30 }), 10);
  page.chips.sync(PULL_REQUEST);
  page.setNow(40);
  page.chips.leave();
  assert.equal(page.visits.lastVisit(PULL_REQUEST), at(40));
});

test("going to another pull request saves the visit of the one left", () => {
  const page = overviewPage(pushRow({ minute: 30 }), 10);
  page.chips.sync(PULL_REQUEST);
  page.setNow(40);
  page.chips.sync(OTHER_PULL_REQUEST);
  assert.equal(page.visits.lastVisit(PULL_REQUEST), at(40));
  assert.equal(page.visits.lastVisit(OTHER_PULL_REQUEST), null);
});

test("leaving another page saves no visit", () => {
  const page = overviewPage(pushRow({ minute: 30 }));
  page.chips.sync(null);
  page.chips.leave();
  assert.equal(page.visits.lastVisit(PULL_REQUEST), null);
  assert.deepEqual(page.chipRows(), []);
});
