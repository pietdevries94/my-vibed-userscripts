// A chevron button that opens and folds a part of the page, built like Azure DevOps's own
// icon buttons so its styles apply.

/** Azure DevOps's chevron for an open and a folded part. */
const CHEVRONS = { folded: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };

/** What the toggle says it does, per state: "Hide commits" while open, "Show commits" while folded. */
interface FoldToggleLabels {
  open: string;
  folded: string;
}

/** The chevron of a toggle. `showFoldToggleState` gives it its direction. */
function createChevron(document: Document): HTMLElement {
  const iconFont = document.createElement("span");
  iconFont.className = "fluent-icons-enabled";
  const chevron = document.createElement("span");
  chevron.className = "left-icon flex-noshrink fabric-icon small";
  chevron.setAttribute("aria-hidden", "true");
  iconFont.append(chevron);
  return iconFont;
}

/** A toggle without a state yet. `className` is the feature's own class for it. */
function createFoldToggle(document: Document, className: string): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `${className} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`;
  toggle.append(createChevron(document));
  return toggle;
}

/** Shows the toggle as open or folded. Writes only what changed, to keep the page's mutation observer quiet. */
function showFoldToggleState(
  toggle: HTMLButtonElement,
  isOpen: boolean,
  labels: FoldToggleLabels,
): void {
  const expanded = String(isOpen);
  if (toggle.getAttribute("aria-expanded") === expanded) {
    return;
  }
  toggle.setAttribute("aria-expanded", expanded);
  toggle.title = isOpen ? labels.open : labels.folded;
  toggle.setAttribute("aria-label", toggle.title);
  const chevron = toggle.querySelector(".fabric-icon");
  chevron?.classList.toggle(CHEVRONS.open, isOpen);
  chevron?.classList.toggle(CHEVRONS.folded, !isOpen);
}

export type { FoldToggleLabels };
export { createFoldToggle, showFoldToggleState };
