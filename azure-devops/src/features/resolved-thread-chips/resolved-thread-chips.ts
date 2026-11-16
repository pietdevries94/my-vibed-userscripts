import {
  RESOLVED_STATUS,
  feedThreadElements,
  feedThreadOf,
} from "../../pull-requests/feed-threads.ts";

const CHIP_CLASS = "fix-ado-resolved-chip";

/** A chip built like Azure DevOps's own pills, so its styles apply. */
function createChip(document: Document): HTMLElement {
  const chip = document.createElement("div");
  chip.className = `${CHIP_CLASS} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
  const content = document.createElement("div");
  content.className = "bolt-pill-content text-ellipsis";
  content.textContent = RESOLVED_STATUS;
  chip.append(content);
  return chip;
}

function syncThread(thread: HTMLElement): void {
  const feedThread = feedThreadOf(thread);
  const chip = thread.querySelector(`.${CHIP_CLASS}`);
  if (feedThread?.isResolved !== true) {
    chip?.remove();
  } else if (chip === null) {
    feedThread.nameAndTime.append(createChip(thread.ownerDocument));
  }
}

/**
 * A Resolved chip on every resolved thread in the activity feed of a pull request's Overview,
 * next to the name of who wrote its first comment. The status comes from the thread's own
 * status dropdown, so the chip follows it at once.
 */
function createResolvedThreadChips({ document }: { document: Document }): { sync: () => void } {
  function sync(): void {
    for (const thread of feedThreadElements(document)) {
      syncThread(thread);
    }
  }

  return { sync };
}

export { createResolvedThreadChips };
