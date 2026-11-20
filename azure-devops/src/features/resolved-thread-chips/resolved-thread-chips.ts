import { feedThreadElements, feedThreadOf } from "../../pull-requests/feed-threads.ts";
import type { FeedThread } from "../../pull-requests/feed-threads.ts";

const CHIP_CLASS = "fix-ado-thread-chip";

interface ChipKind {
  label: string;
  /** The class that gives the chip its colour (style.css). */
  className: string;
}

/** A chip with the thread's status as its text, coloured by its group. Null without a status. */
function chipKindOf(feedThread: FeedThread | null): ChipKind | null {
  if (feedThread === null || feedThread.status === "") {
    return null;
  }
  const { isResolved, isUnresolved, status } = feedThread;
  if (isResolved) {
    return { className: "fix-ado-resolved-chip", label: status };
  }
  return {
    className: isUnresolved ? "fix-ado-unresolved-chip" : "fix-ado-done-chip",
    label: status,
  };
}

/** A chip built like Azure DevOps's own pills, so its styles apply. */
function createChip(document: Document, { className, label }: ChipKind): HTMLElement {
  const chip = document.createElement("div");
  chip.className = `${CHIP_CLASS} ${className} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
  const content = document.createElement("div");
  content.className = "bolt-pill-content text-ellipsis";
  content.textContent = label;
  chip.append(content);
  return chip;
}

function syncThread(thread: HTMLElement): void {
  const feedThread = feedThreadOf(thread);
  const kind = chipKindOf(feedThread);
  const chip = thread.querySelector(`.${CHIP_CLASS}`);
  if (
    kind !== null &&
    chip?.classList.contains(kind.className) === true &&
    chip.textContent === kind.label
  ) {
    return;
  }
  chip?.remove();
  if (feedThread !== null && kind !== null) {
    feedThread.timeBox.append(createChip(thread.ownerDocument, kind));
  }
}

/**
 * A chip with its status on every thread in the activity feed of a pull request's Overview,
 * after the time of its first comment: green for Resolved, orange for Active and Pending, grey
 * for another done status such as Won't fix or Closed. The status comes from the thread's own
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
