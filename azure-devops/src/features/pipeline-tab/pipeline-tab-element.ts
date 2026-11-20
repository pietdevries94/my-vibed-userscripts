// The Pipeline tab in Azure DevOps's tab bar, built like its own tabs.

const TAB_CLASS = "fix-ado-pipeline-tab";
const TAB_LABEL = "Pipeline";
/** The tab's id; the panel is named by it. */
const TAB_ID = "fix-ado-pipeline-tab";
const TAB_CLASSES = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`;
/** On the script's own tabs in Azure DevOps's tab bar, such as this one and the run page tabs. */
const OWN_TAB_ATTRIBUTE = "data-fix-ado-own-tab";

/** A tab like Azure DevOps's own. data-content keeps the width of the bold selected label. */
function createTab(document: Document): HTMLAnchorElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-tab-text",
    textContent: TAB_LABEL,
  });
  text.dataset.content = TAB_LABEL;
  const container = Object.assign(document.createElement("span"), {
    className: "bolt-tab-inner-container",
  });
  container.append(text);
  const tab = Object.assign(document.createElement("a"), {
    className: TAB_CLASSES,
    href: "#",
    id: TAB_ID,
  });
  tab.setAttribute("role", "tab");
  tab.dataset.fixAdoOwnTab = "";
  tab.append(container);
  tab.setAttribute("aria-selected", "false");
  return tab;
}

export { OWN_TAB_ATTRIBUTE, TAB_CLASS, TAB_ID, createTab };
