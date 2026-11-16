const THREAD_SELECTOR = ".activity-feed-list .repos-discussion-thread";
const HEADER_SELECTOR = ".repos-discussion-comment-header";
/** The thread's status dropdown, in the header of its first comment. */
const STATUS_SELECTOR = ".bolt-dropdown-expandable .bolt-dropdown-expandable-button-label";
const CHIP_CLASS = "fix-ado-resolved-chip";
/** The word Azure DevOps shows as the status of a resolved thread. */
const RESOLVED = "Resolved";

/** A chip built like Azure DevOps's own pills, so its styles apply. */
function createChip(document: Document): HTMLElement {
  const chip = document.createElement("div");
  chip.className = `${CHIP_CLASS} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
  const content = document.createElement("div");
  content.className = "bolt-pill-content text-ellipsis";
  content.textContent = RESOLVED;
  chip.append(content);
  return chip;
}

/** Adds the chip after the name and time of the comment, when it is not there yet. */
function addChip(header: Element): void {
  const nameAndTime = header.firstElementChild;
  if (nameAndTime !== null && nameAndTime.querySelector(`.${CHIP_CLASS}`) === null) {
    nameAndTime.append(createChip(header.ownerDocument));
  }
}

function syncThread(thread: Element): void {
  const header = thread.querySelector(HEADER_SELECTOR);
  const status = header?.querySelector(STATUS_SELECTOR)?.textContent.trim();
  if (header !== null && header !== undefined && status === RESOLVED) {
    addChip(header);
  } else {
    thread.querySelector(`.${CHIP_CLASS}`)?.remove();
  }
}

/**
 * A Resolved chip on every resolved thread in the activity feed of a pull request's Overview,
 * next to the name of who wrote its first comment. The status comes from the thread's own
 * status dropdown, so the chip follows it at once.
 */
function createResolvedThreadChips({ document }: { document: Document }): { sync: () => void } {
  function sync(): void {
    for (const thread of document.querySelectorAll(THREAD_SELECTOR)) {
      syncThread(thread);
    }
  }

  return { sync };
}

export { createResolvedThreadChips };
