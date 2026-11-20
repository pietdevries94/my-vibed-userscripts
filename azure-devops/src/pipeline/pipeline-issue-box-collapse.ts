// The collapse button of an issue box, or of the Overview's card of them: the one on
// Azure DevOps's cards, with its class names, so its own styles apply. A collapsed box
// keeps its header row.

interface IssueBoxCollapse {
  isCollapsed: boolean;
  onToggle: (isCollapsed: boolean) => void;
}

/** Azure DevOps's chevron for an open and a collapsed card. */
const COLLAPSE_ICONS = { collapsed: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };

/** Shows the box collapsed or open: its issues hide by style, the button gets its state and chevron. */
function setCollapsed(box: HTMLElement, button: HTMLElement, isCollapsed: boolean): void {
  box.toggleAttribute("data-collapsed", isCollapsed);
  button.setAttribute("aria-expanded", String(!isCollapsed));
  const icon = button.querySelector(".fabric-icon");
  icon?.classList.toggle(COLLAPSE_ICONS.collapsed, isCollapsed);
  icon?.classList.toggle(COLLAPSE_ICONS.open, !isCollapsed);
}

/** The chevron of the button. `setCollapsed` gives it its direction. */
function createChevron(document: Document): HTMLElement {
  const iconFont = document.createElement("span");
  iconFont.className = "fluent-icons-enabled";
  const icon = document.createElement("span");
  icon.className = "left-icon flex-noshrink fabric-icon small";
  icon.setAttribute("aria-hidden", "true");
  iconFont.append(icon);
  return iconFont;
}

function createCollapseButton(document: Document): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment fix-ado-issue-box-collapse";
  button.setAttribute("aria-label", "Errors and warnings");
  button.append(createChevron(document));
  return button;
}

/** Puts a collapse button first in the box's header row, and shows the box as the state says. */
function addCollapseButton(
  box: HTMLElement,
  header: HTMLElement,
  collapse: IssueBoxCollapse,
): void {
  const button = createCollapseButton(box.ownerDocument);
  button.addEventListener("click", () => {
    const isCollapsed = !Object.hasOwn(box.dataset, "collapsed");
    setCollapsed(box, button, isCollapsed);
    collapse.onToggle(isCollapsed);
  });
  header.prepend(button);
  setCollapsed(box, button, collapse.isCollapsed);
}

export type { IssueBoxCollapse };
export { addCollapseButton };
