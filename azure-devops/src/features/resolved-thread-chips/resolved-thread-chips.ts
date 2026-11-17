import {
  RESOLVED_STATUS,
  feedThreadElements,
  feedThreadOf,
} from "../../pull-requests/feed-threads.ts";
import type { FeedThread } from "../../pull-requests/feed-threads.ts";

const CHIP_CLASS = "fix-ado-thread-chip";
const UNRESOLVED_LABEL = "Unresolved";

interface ChipKind {
  label: string;
  /** The class that gives the chip its colour (style.css). */
  className: string;
}

const RESOLVED_CHIP: ChipKind = { className: "fix-ado-resolved-chip", label: RESOLVED_STATUS };
const UNRESOLVED_CHIP: ChipKind = { className: "fix-ado-unresolved-chip", label: UNRESOLVED_LABEL };

function chipKindOf(feedThread: FeedThread | null): ChipKind | null {
  if (feedThread?.isResolved === true) {
    return RESOLVED_CHIP;
  }
  if (feedThread?.isUnresolved === true) {
    return UNRESOLVED_CHIP;
  }
  return null;
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
  if (kind !== null && chip?.classList.contains(kind.className) === true) {
    return;
  }
  chip?.remove();
  if (feedThread !== null && kind !== null) {
    feedThread.timeBox.append(createChip(thread.ownerDocument, kind));
  }
}

/**
 * A Resolved chip on every resolved thread in the activity feed of a pull request's Overview,
 * and an Unresolved chip on every active or pending one, after the time of its first comment.
 * The status comes from the thread's own status dropdown, so the chip follows it at once.
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
