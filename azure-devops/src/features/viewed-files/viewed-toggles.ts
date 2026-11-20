// The Viewed toggle in the header of every file in the Files tab: on each file card
// when a folder is open, and in the bar above a single file.

/** A file card: Azure DevOps draws one per file when a folder is open. */
const FILE_CARD_SELECTOR = ".repos-summary-header";
/** The full path under the file name in a file card's header. */
const CARD_PATH_SELECTOR = ":scope > div:first-child .secondary-text.text-ellipsis";
/** The place right of the file name, which holds the View link. */
const CARD_ACTIONS_SELECTOR = ":scope > div:first-child .justify-end";
const CARD_EXPAND_SELECTOR = ".bolt-card-expand-button";
/** The bar above the single-file view. Above an open folder it names the folder. */
const FILE_BAR_SELECTOR = ".repos-compare-toolbar";
/** The right pane while it shows an open folder's file cards. */
const FOLDER_VIEW_SELECTOR = ".repos-changes-viewer.is-folder";
/** The full path under the file name in the bar above the single-file view. */
const BAR_PATH_SELECTOR = ".secondary-text.text-ellipsis";
/** The Inline or Side-by-side button: the toggle goes before it. */
const BAR_LAYOUT_SELECTOR = ".bolt-split-button";
const TOGGLE_CLASS = "fix-ado-viewed-toggle";
const PATH_ATTRIBUTE = "data-fix-ado-viewed-path";
const LABEL = "Viewed";

/** A file header the toggle sits in. */
interface FileHeader {
  path: string;
  /** The file's card, or null in the single-file view. */
  card: Element | null;
}

interface ToggleState {
  isViewed: (path: string) => boolean;
  onToggle: (header: FileHeader, isViewed: boolean) => void;
}

/** A path as the tree's listing writes it: from the root, with a leading slash. */
function asTreePath(shown: string): string {
  return shown.startsWith("/") ? shown : `/${shown}`;
}

/** What the toggles show and do now. A toggle reads it on each click. */
const stateByDocument = new WeakMap<Document, ToggleState>();

/** The header a toggle sits in now: Azure DevOps reuses a card for another file. */
function headerOf(toggle: HTMLLabelElement): FileHeader {
  return {
    card: toggle.closest(FILE_CARD_SELECTOR),
    path: toggle.getAttribute(PATH_ATTRIBUTE) ?? "",
  };
}

function createToggle(document: Document): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = `${TOGGLE_CLASS} body-m`;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.addEventListener("change", () => {
    stateByDocument.get(document)?.onToggle(headerOf(label), input.checked);
  });
  label.append(input, LABEL);
  return label;
}

/** The toggle in `container` for the file at `path`, made and placed by `place` when it is not there yet. */
function toggleIn(
  container: Element,
  place: (toggle: HTMLLabelElement) => void,
  { path, state }: { path: string; state: ToggleState },
): void {
  const toggle =
    container.querySelector<HTMLLabelElement>(`:scope .${TOGGLE_CLASS}`) ??
    createToggle(container.ownerDocument);
  if (!toggle.isConnected) {
    place(toggle);
  }
  toggle.setAttribute(PATH_ATTRIBUTE, path);
  const input = toggle.querySelector("input");
  const isViewed = state.isViewed(path);
  if (input !== null && input.checked !== isViewed) {
    input.checked = isViewed;
  }
}

function syncCardToggles(document: Document, state: ToggleState): void {
  for (const card of document.querySelectorAll(FILE_CARD_SELECTOR)) {
    const shown = card.querySelector(CARD_PATH_SELECTOR)?.textContent.trim() ?? "";
    const actions = card.querySelector(CARD_ACTIONS_SELECTOR);
    if (shown !== "" && actions !== null) {
      toggleIn(
        actions,
        (toggle) => {
          actions.prepend(toggle);
        },
        { path: asTreePath(shown), state },
      );
    }
  }
}

/** True while the right pane shows an open folder's file cards, not a single file. */
function isFolderView(document: Document): boolean {
  return document.querySelector(FOLDER_VIEW_SELECTOR) !== null;
}

function syncBarToggle(document: Document, state: ToggleState): void {
  if (isFolderView(document)) {
    document.querySelector(`${FILE_BAR_SELECTOR} .${TOGGLE_CLASS}`)?.remove();
    return;
  }
  const bar = document.querySelector(FILE_BAR_SELECTOR);
  const shown = bar?.querySelector(BAR_PATH_SELECTOR)?.textContent.trim() ?? "";
  const layout = bar?.querySelector(BAR_LAYOUT_SELECTOR);
  if (bar !== null && layout !== null && layout !== undefined && shown !== "") {
    toggleIn(
      bar,
      (toggle) => {
        layout.before(toggle);
      },
      { path: asTreePath(shown), state },
    );
  }
}

/** Shows a Viewed toggle in every file header, checked when the file is viewed. */
function syncViewedToggles(document: Document, state: ToggleState): void {
  stateByDocument.set(document, state);
  syncCardToggles(document, state);
  syncBarToggle(document, state);
}

/** Opens or collapses a file card, as its own chevron does. */
function setCardOpen(card: Element, isOpen: boolean): void {
  const expand = card.querySelector<HTMLElement>(CARD_EXPAND_SELECTOR);
  if (expand !== null && (expand.getAttribute("aria-expanded") === "true") !== isOpen) {
    expand.click();
  }
}

export { isFolderView, setCardOpen, syncViewedToggles };
export type { FileHeader };
