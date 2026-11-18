const ROW_SELECTOR = ".activity-feed-list .bolt-timeline-row";
/** Azure DevOps marks the timeline of a row with activity the viewer has not seen yet. */
const NEW_ROW_SELECTOR = ".activity-feed-sequence.new";
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

/** Where the chip goes: after the box of the row's time. Null for a row without a time. */
function timeBoxOf(row: Element): Element | null {
  return row.querySelector("time")?.parentElement ?? null;
}

function syncRow(row: Element): void {
  const chip = row.querySelector(`.${CHIP_CLASS}`);
  const timeBox = timeBoxOf(row);
  const wantsChip =
    timeBox !== null &&
    row.querySelector(NEW_ROW_SELECTOR) !== null &&
    row.querySelector(THREAD_SELECTOR) === null;
  if (!wantsChip) {
    chip?.remove();
    return;
  }
  if (chip === null || timeBox.nextElementSibling !== chip) {
    timeBox.after(chip ?? createChip(row.ownerDocument));
  }
}

/**
 * A New chip that glows on every row of the activity feed of a pull request's Overview that
 * Azure DevOps marks as new, such as a push or a vote, after the row's time. Threads get none.
 */
function createNewActivityChips({ document }: { document: Document }): { sync: () => void } {
  function sync(): void {
    for (const row of document.querySelectorAll(ROW_SELECTOR)) {
      syncRow(row);
    }
  }

  return { sync };
}

export { createNewActivityChips };
