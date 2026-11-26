// The organization panel: the side panel on the pages outside a project, the inbox, Work
// and the organization's home. A button next to Organization settings collapses it to its
// icons, as the one next to Project settings does on a project. style.css draws the collapsed panel from a mark on <html>, so
// Azure DevOps redrawing the panel does not undo it.

const PANEL_FOOTER_SELECTOR = ".top-level-navigation .navigation-footer";
const TOGGLE_CLASS = "fix-ado-organization-panel-toggle";
const COLLAPSED_ATTRIBUTE = "data-fix-ado-organization-panel-collapsed";
const ICON_CLASS = "flex-noshrink fabric-icon medium";

interface OrganizationPanelOptions {
  document: Document;
  /** Whether the owner left the panel collapsed. */
  load: () => boolean;
  save: (isCollapsed: boolean) => void;
}

interface OrganizationPanel {
  /** Marks the page collapsed or not, and adds the button when the panel is there without it. */
  sync: () => void;
}

function setAttributeOnChange(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** Its name and a double chevron that points to where the panel goes. Writes only on a change. */
function showToggle(toggle: HTMLButtonElement, isCollapsed: boolean): void {
  const label = isCollapsed ? "Expand side panel" : "Collapse side panel";
  setAttributeOnChange(toggle, "aria-label", label);
  setAttributeOnChange(toggle, "title", label);
  setAttributeOnChange(toggle, "aria-expanded", String(!isCollapsed));
  const icon = toggle.querySelector(".fabric-icon");
  const chevron = isCollapsed ? "DoubleChevronRight" : "DoubleChevronLeft";
  if (icon) {
    setAttributeOnChange(icon, "class", `${ICON_CLASS} ms-Icon--${chevron}`);
  }
}

function createToggle(document: Document, onClick: () => void): HTMLButtonElement {
  const toggle = Object.assign(document.createElement("button"), {
    className: `${TOGGLE_CLASS} alt-hover-effect focus-treatment`,
    type: "button",
  });
  const wrapper = Object.assign(document.createElement("span"), {
    className: "fluent-icons-enabled",
  });
  const icon = Object.assign(document.createElement("span"), { className: ICON_CLASS });
  icon.setAttribute("aria-hidden", "true");
  wrapper.append(icon);
  toggle.append(wrapper);
  toggle.addEventListener("click", onClick);
  return toggle;
}

function createOrganizationPanel({
  document,
  load,
  save,
}: OrganizationPanelOptions): OrganizationPanel {
  let isCollapsed = load();

  function show(): void {
    const root = document.documentElement;
    if (root.hasAttribute(COLLAPSED_ATTRIBUTE) !== isCollapsed) {
      root.toggleAttribute(COLLAPSED_ATTRIBUTE, isCollapsed);
    }
    const toggle = document.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
    if (toggle) {
      showToggle(toggle, isCollapsed);
    }
  }

  function flip(): void {
    isCollapsed = !isCollapsed;
    save(isCollapsed);
    show();
  }

  return {
    sync() {
      const footer = document.querySelector(PANEL_FOOTER_SELECTOR);
      if (footer && !footer.querySelector(`.${TOGGLE_CLASS}`)) {
        footer.append(createToggle(document, flip));
      }
      show();
    },
  };
}

export { createOrganizationPanel };
