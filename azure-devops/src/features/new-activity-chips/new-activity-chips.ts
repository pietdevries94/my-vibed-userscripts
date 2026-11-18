import type { VisitStore } from "./visit-store.ts";

const ROW_SELECTOR = ".activity-feed-list .bolt-timeline-row";
/** Azure DevOps flags the timeline of some rows the owner has not seen yet, though never a push. */
const FLAGGED_ROW_SELECTOR = ".activity-feed-sequence.new";
/** A comment thread. Its unread comments glow (unread-comments), so it needs no chip. */
const THREAD_SELECTOR = ".repos-discussion-thread";
const CHIP_CLASS = "fix-ado-new-chip";
const CHIP_LABEL = "New";

/** A chip built like Azure DevOps's own pills, so its styles apply. */
function createChip(document: Document): HTMLElement {
  const chip = document.createElement("div");
  chip.className = `${CHIP_CLASS} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
  const content = document.createElement("div");
  content.className = "bolt-pill-content text-ellipsis";
  content.textContent = CHIP_LABEL;
  chip.append(content);
  return chip;
}

/** True when the row is newer than the last visit, or Azure DevOps flags it. Never a thread. */
function isNewRow(row: Element, time: HTMLTimeElement, lastVisit: number | null): boolean {
  if (row.querySelector(THREAD_SELECTOR) !== null) {
    return false;
  }
  const happenedAt = Date.parse(time.dateTime);
  const isAfterLastVisit = lastVisit !== null && happenedAt > lastVisit;
  return isAfterLastVisit || row.querySelector(FLAGGED_ROW_SELECTOR) !== null;
}

/** Puts the chip after the box of the row's time, or takes it away. */
function syncRow(row: Element, lastVisit: number | null): void {
  const chip = row.querySelector(`.${CHIP_CLASS}`);
  const time = row.querySelector("time");
  const timeBox = time?.parentElement ?? null;
  if (time === null || timeBox === null || !isNewRow(row, time, lastVisit)) {
    chip?.remove();
    return;
  }
  if (chip === null || timeBox.nextElementSibling !== chip) {
    timeBox.after(chip ?? createChip(row.ownerDocument));
  }
}

interface NewActivityChipsOptions {
  document: Document;
  visits: VisitStore;
  now: () => number;
}

interface NewActivityChips {
  /** Shows the chips on the pull request with this key, or on no pull request with null. */
  sync: (pullRequestKey: string | null) => void;
  /** Saves the visit of the pull request shown, such as when the owner leaves the page. */
  leave: () => void;
}

/**
 * A New chip that glows on every row of the activity feed of a pull request's Overview that
 * happened after the owner last left it, such as a push or a vote, after the row's time.
 * The last visit is read once on arrival, so the chips stay while the owner reads. Rows Azure
 * DevOps flags as new get one too, which covers the first visit. Threads get none.
 */
function createNewActivityChips({
  document,
  now,
  visits,
}: NewActivityChipsOptions): NewActivityChips {
  let shownKey: string | null = null;
  let lastVisit: number | null = null;

  function leave(): void {
    if (shownKey !== null) {
      visits.save(shownKey, now());
    }
  }

  function sync(pullRequestKey: string | null): void {
    if (pullRequestKey !== shownKey) {
      leave();
      shownKey = pullRequestKey;
      lastVisit = pullRequestKey === null ? null : visits.lastVisit(pullRequestKey);
    }
    if (pullRequestKey === null) {
      return;
    }
    for (const row of document.querySelectorAll(ROW_SELECTOR)) {
      syncRow(row, lastVisit);
    }
  }

  return { leave, sync };
}

export { createNewActivityChips };
