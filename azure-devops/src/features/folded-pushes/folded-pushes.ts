const HEADER_SELECTOR = ".activity-feed-list .iteration-card-header";
const TITLE_SELECTOR = ".iteration-header .font-weight-semibold";
const COMMITS_SELECTOR = ".bolt-table-container";
const TOGGLE_CLASS = "fix-ado-push-toggle";
/** Azure DevOps's chevron for an open and a folded card. */
const CHEVRONS = { folded: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };

type PushState = "folded" | "open";

/** A push in the activity feed: its card, the link that heads it, and what tells it from other pushes. */
interface Push {
  card: HTMLElement;
  header: HTMLElement;
  /** When it was pushed. Null while Azure DevOps has not rendered the time. */
  pushedAt: string | null;
}

function pushOf(header: HTMLElement): Push | null {
  const card = header.closest<HTMLElement>(".bolt-card");
  if (card === null) {
    return null;
  }
  const pushedAt = header.querySelector("time")?.getAttribute("datetime") ?? null;
  return { card, header, pushedAt };
}

/** The chevron of a toggle. `showToggleState` gives it its direction. */
function createChevron(document: Document): HTMLElement {
  const iconFont = document.createElement("span");
  iconFont.className = "fluent-icons-enabled";
  const chevron = document.createElement("span");
  chevron.className = "left-icon flex-noshrink fabric-icon small";
  chevron.setAttribute("aria-hidden", "true");
  iconFont.append(chevron);
  return iconFont;
}

function createToggle(document: Document): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `${TOGGLE_CLASS} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`;
  toggle.append(createChevron(document));
  return toggle;
}

/** The toggle of a push, added after its title when it is not there yet. Null when the push has no title. */
function findOrAddToggle(
  { header }: Push,
  onClick: (header: HTMLElement) => void,
): HTMLButtonElement | null {
  const existing = header.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const title = header.querySelector(TITLE_SELECTOR);
  if (title === null) {
    return null;
  }
  const toggle = createToggle(header.ownerDocument);
  toggle.addEventListener("click", (event) => {
    // The header is a link.
    event.preventDefault();
    event.stopPropagation();
    onClick(header);
  });
  title.after(toggle);
  return toggle;
}

/** Writes only what changed, to keep the page's mutation observer quiet. */
function showToggleState(toggle: HTMLButtonElement, state: PushState): void {
  const expanded = String(state === "open");
  if (toggle.getAttribute("aria-expanded") === expanded) {
    return;
  }
  toggle.setAttribute("aria-expanded", expanded);
  toggle.title = state === "open" ? "Hide commits" : "Show commits";
  toggle.setAttribute("aria-label", toggle.title);
  const chevron = toggle.querySelector(".fabric-icon");
  chevron?.classList.toggle(CHEVRONS.open, state === "open");
  chevron?.classList.toggle(CHEVRONS.folded, state === "folded");
}

/**
 * The pushes in the activity feed of a pull request's Overview, each folded to one line like
 * the feed's other updates (style.css). A toggle after the title shows the push's commits,
 * in Azure DevOps's own card. Open pushes are folded again after a reload.
 */
function createFoldedPushes({ document }: { document: Document }): { sync: () => void } {
  /** The `pushedAt` of every open push. */
  const openPushes = new Set<string>();

  function flip(header: HTMLElement): void {
    const pushedAt = pushOf(header)?.pushedAt ?? null;
    if (pushedAt === null) {
      return;
    }
    if (!openPushes.delete(pushedAt)) {
      openPushes.add(pushedAt);
    }
    sync();
  }

  function syncPush(push: Push): void {
    const hasCommits = push.card.querySelector(COMMITS_SELECTOR) !== null;
    const isOpen = hasCommits && push.pushedAt !== null && openPushes.has(push.pushedAt);
    const state: PushState = isOpen ? "open" : "folded";
    if (push.card.dataset.fixAdoPush !== state) {
      push.card.dataset.fixAdoPush = state;
    }
    if (hasCommits) {
      const toggle = findOrAddToggle(push, flip);
      if (toggle !== null) {
        showToggleState(toggle, state);
      }
    } else {
      push.header.querySelector(`.${TOGGLE_CLASS}`)?.remove();
    }
  }

  function sync(): void {
    for (const header of document.querySelectorAll<HTMLElement>(HEADER_SELECTOR)) {
      const push = pushOf(header);
      if (push !== null) {
        syncPush(push);
      }
    }
  }

  return { sync };
}

export { createFoldedPushes };
