// The Expand all and Collapse viewed buttons in the Files tab's toolbar, right after
// the Filter button. They act on the file cards and the file tree.
import { log } from "../../../../shared/runtime/script-log.ts";

const FILTER_SELECTOR = ".repos-compare-filter";
const BOX_CLASS = "fix-ado-viewed-toolbar-buttons";

/** What a toolbar button does. */
type ToolbarAction = "expand-all" | "collapse-viewed";

const TOOLBAR_BUTTONS: { action: ToolbarAction; label: string }[] = [
  { action: "expand-all", label: "Expand all" },
  { action: "collapse-viewed", label: "Collapse viewed" },
];

/** What a click on a toolbar button does now. A button reads it on each click. */
const onClickByDocument = new WeakMap<Document, (action: ToolbarAction) => void>();

function createButton(
  document: Document,
  { action, label }: { action: ToolbarAction; label: string },
): HTMLButtonElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text body-m",
    textContent: label,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bolt-button enabled bolt-focus-treatment";
  button.append(text);
  button.addEventListener("click", () => {
    onClickByDocument.get(document)?.(action);
  });
  return button;
}

function createBox(document: Document): HTMLElement {
  const box = Object.assign(document.createElement("div"), {
    className: `${BOX_CLASS} inline-flex-row rhythm-horizontal-8`,
  });
  box.append(...TOOLBAR_BUTTONS.map((toolbarButton) => createButton(document, toolbarButton)));
  return box;
}

/** Shows the toolbar buttons right after the Filter button, and sets what their clicks do. */
function syncToolbarButtons(document: Document, onClick: (action: ToolbarAction) => void): void {
  onClickByDocument.set(document, onClick);
  const filter = document.querySelector(FILTER_SELECTOR);
  if (filter === null) {
    return;
  }
  if (filter.nextElementSibling?.classList.contains(BOX_CLASS) !== true) {
    document.querySelector(`.${BOX_CLASS}`)?.remove();
    filter.after(createBox(document));
    log("Viewed files: toolbar buttons added");
  }
}

/** Takes the toolbar buttons away, as when the Files tab is not shown. */
function removeToolbarButtons(document: Document): void {
  document.querySelector(`.${BOX_CLASS}`)?.remove();
}

export { removeToolbarButtons, syncToolbarButtons };
export type { ToolbarAction };
