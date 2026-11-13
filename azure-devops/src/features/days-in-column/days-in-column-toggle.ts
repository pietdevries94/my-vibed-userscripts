const HEADER_SELECTOR = ".kanban-board-column-header";
const COLUMN_SELECTOR = ".kanban-board-column[data-column]";
const TOGGLE_CLASS = "fix-ado-days-toggle";
const TOGGLE_DOT_COUNT = 3;

interface HiddenColumnStorage {
  load: () => string[];
  save: (columnIds: string[]) => void;
}

/** Sets the hidden mark and the toggle state. Writes only what changed, to keep the page's mutation observer quiet. */
function showColumnState(column: HTMLElement, toggle: HTMLButtonElement, isHidden: boolean): void {
  if (Object.hasOwn(column.dataset, "fixAdoDaysHidden") !== isHidden) {
    if (isHidden) {
      column.dataset.fixAdoDaysHidden = "";
    } else {
      delete column.dataset.fixAdoDaysHidden;
    }
  }
  const pressed = String(!isHidden);
  if (toggle.getAttribute("aria-pressed") !== pressed) {
    toggle.setAttribute("aria-pressed", pressed);
    toggle.title = isHidden ? "Show days in column" : "Hide days in column";
    toggle.setAttribute("aria-label", toggle.title);
  }
}

function createToggle(document: Document, onClick: () => void): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = TOGGLE_CLASS;
  toggle.append(...Array.from({ length: TOGGLE_DOT_COUNT }, () => document.createElement("span")));
  toggle.addEventListener("click", (event) => {
    // The header reacts to clicks itself.
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return toggle;
}

/** The toggle in a header, added after the column name when it is not there yet. */
function findOrAddToggle(header: HTMLElement, onClick: () => void): HTMLButtonElement {
  const existing = header.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const toggle = createToggle(header.ownerDocument, onClick);
  const name = header.querySelector(".justify-space-between > .flex-row");
  (name ?? header).append(toggle);
  return toggle;
}

/**
 * A toggle per board column that hides or shows the days-in-column bars in it.
 * The toggle shows when the owner hovers the column header (style.css).
 */
function createDaysInColumnToggles(options: { document: Document; storage: HiddenColumnStorage }): {
  sync: () => void;
} {
  const { document, storage } = options;
  const hiddenColumnIds = new Set(storage.load());

  function flip(columnId: string): void {
    if (!hiddenColumnIds.delete(columnId)) {
      hiddenColumnIds.add(columnId);
    }
    storage.save([...hiddenColumnIds]);
    sync();
  }

  function sync(): void {
    const headers = [...document.querySelectorAll<HTMLElement>(HEADER_SELECTOR)];
    const columns = [...document.querySelectorAll<HTMLElement>(COLUMN_SELECTOR)];
    // Headers and columns are matched by position. Without a match, a toggle could hide the wrong column.
    if (headers.length !== columns.length) {
      return;
    }
    for (const [index, header] of headers.entries()) {
      const column = columns[index];
      const columnId = column?.dataset.column;
      if (column !== undefined && columnId !== undefined) {
        const toggle = findOrAddToggle(header, () => {
          flip(columnId);
        });
        showColumnState(column, toggle, hiddenColumnIds.has(columnId));
      }
    }
  }

  return { sync };
}

export type { HiddenColumnStorage };
export { createDaysInColumnToggles };
