// The run page tabs in a pull request's tab bar, built like Azure DevOps's own tabs, and
// the panel one shows: the run page on that tab in a frame, or a note when the run lacks it.
import type { PullRequestRunTab } from "./pull-request-run-tabs-data.ts";
import { RUN_TAB_FRAME_CLASS } from "./run-tab-frame.ts";

const TAB_CLASS = "fix-ado-run-tab";
const PANEL_CLASS = "fix-ado-run-tab-panel";
const MISSING_CLASS = "fix-ado-run-tab-missing";

interface PanelParts {
  frame: HTMLIFrameElement;
  note: HTMLElement;
}

function setSelected(tab: Element, isSelected: boolean): void {
  tab.classList.toggle("selected", isSelected);
  tab.setAttribute("aria-selected", String(isSelected));
}

/** Sets or removes an attribute, only when it changes, to keep the page's observers quiet. */
function setAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function createTab(document: Document, key: string): HTMLAnchorElement {
  const container = Object.assign(document.createElement("span"), {
    className: "bolt-tab-inner-container",
  });
  container.append(Object.assign(document.createElement("span"), { className: "bolt-tab-text" }));
  const tab = Object.assign(document.createElement("a"), {
    className: `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`,
    href: "#",
    id: `fix-ado-run-tab-${key.replaceAll(/[^\w-]/gu, "-")}`,
  });
  tab.setAttribute("role", "tab");
  // A tab of the script's own, as the Pipeline tab is: its selection is the script's to restore.
  tab.dataset.fixAdoOwnTab = "";
  tab.dataset.fixAdoRunTab = key;
  setSelected(tab, false);
  tab.append(container);
  return tab;
}

/** Writes the tab's name and whether it has a run. */
function showTab(tab: HTMLElement, { buildId, name, tab: runTab }: PullRequestRunTab): void {
  const text = tab.querySelector<HTMLElement>(".bolt-tab-text");
  if (text !== null && text.textContent !== name) {
    text.textContent = name;
    // Azure DevOps keeps room for the bold selected label by this.
    text.dataset.content = name;
  }
  const isDisabled = buildId === null;
  setAttribute(tab, "aria-disabled", isDisabled ? "true" : null);
  setAttribute(tab, "title", isDisabled ? `No run of ${runTab.pipelineName} yet` : null);
  tab.classList.toggle("fix-ado-run-tab-disabled", isDisabled);
}

/** The run page tabs for these, reusing the tab bar's own and removing those that went. */
function tabsFor(tablist: Element, runTabs: PullRequestRunTab[]): HTMLElement[] {
  const existing = new Map(
    [...tablist.querySelectorAll<HTMLElement>(`.${TAB_CLASS}`)].map((tab) => [
      tab.dataset.fixAdoRunTab ?? "",
      tab,
    ]),
  );
  for (const [key, tab] of existing) {
    if (!runTabs.some((runTab) => runTab.key === key)) {
      tab.remove();
    }
  }
  return runTabs.map(
    (runTab) => existing.get(runTab.key) ?? createTab(tablist.ownerDocument, runTab.key),
  );
}

/** The tab bar's run page tabs, in this order at its end. Moves them only when they are not. */
function showTabs(tablist: Element, runTabs: PullRequestRunTab[]): HTMLElement[] {
  const tabs = tabsFor(tablist, runTabs);
  const tail = [...tablist.children].slice(-tabs.length);
  if (tabs.some((tab, index) => tail[index] !== tab)) {
    tablist.append(...tabs);
  }
  for (const [index, tab] of tabs.entries()) {
    const runTab = runTabs[index];
    if (runTab !== undefined) {
      showTab(tab, runTab);
    }
  }
  return tabs;
}

/** The panel, named by its tab: the frame, and the note in its place when the run lacks the tab. */
function createPanel(document: Document, tab: HTMLElement): PanelParts & { panel: HTMLElement } {
  const panel = Object.assign(document.createElement("div"), { className: PANEL_CLASS });
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tab.id);
  const frame = Object.assign(document.createElement("iframe"), { className: RUN_TAB_FRAME_CLASS });
  const note = Object.assign(document.createElement("p"), {
    className: MISSING_CLASS,
    hidden: true,
  });
  note.setAttribute("role", "status");
  panel.append(frame, note);
  return { frame, note, panel };
}

/** The frame and note of the open tab's panel under the tab bar, named by its tab. */
function panelPartsIn(page: Element, tab: HTMLElement): PanelParts {
  const existing = page.querySelector<HTMLElement>(`:scope > .${PANEL_CLASS}`);
  const frame = existing?.querySelector<HTMLIFrameElement>(`.${RUN_TAB_FRAME_CLASS}`) ?? null;
  const note = existing?.querySelector<HTMLElement>(`.${MISSING_CLASS}`) ?? null;
  if (existing !== null && frame !== null && note !== null) {
    setAttribute(existing, "aria-labelledby", tab.id);
    return { frame, note };
  }
  existing?.remove();
  const created = createPanel(page.ownerDocument, tab);
  page.querySelector(".repos-pr-details-page-tabbar")?.after(created.panel);
  return created;
}

/** The note in place of the frame, when the run page in it told the frame its tab is missing. */
function showMissingNote({ frame, note }: PanelParts, runTab: PullRequestRunTab): void {
  const isMissing = frame.dataset.fixAdoMissingTab === runTab.tab.view;
  frame.hidden = isMissing;
  note.hidden = !isMissing;
  const text = `This run has no ${runTab.tab.label} tab.`;
  if (note.textContent !== text) {
    note.textContent = text;
  }
}

/** The panel shows the run page at this path, or the note when its tab is missing. */
function showPanel(
  page: Element,
  tab: HTMLElement,
  { path, runTab }: { path: string; runTab: PullRequestRunTab },
): void {
  const { frame, note } = panelPartsIn(page, tab);
  setAttribute(frame, "title", runTab.name);
  if (frame.getAttribute("src") !== path) {
    delete frame.dataset.fixAdoMissingTab;
    frame.setAttribute("src", path);
  }
  showMissingNote({ frame, note }, runTab);
}

export { PANEL_CLASS, TAB_CLASS, setSelected, showPanel, showTabs };
