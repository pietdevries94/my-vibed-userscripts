// The Pipeline tab on a pull request. It shows the pull request's pipeline runs, their
// stages and steps, and a step's log, in the pull request itself. Run links on the
// pull request and in its checks panel open there too.
import { PANEL_CLASS, createPanel, renderPanel } from "./pipeline-tab-panel.ts";
import type {
  PipelineTabData,
  PipelineTabLoader,
  PipelineTabSources,
} from "./pipeline-tab-data.ts";
import {
  createTabData,
  expireTimeline,
  loadWhatIsDue,
  performRunAction,
  shownRunOfData,
} from "./pipeline-tab-data.ts";
import { parsePipelineRunLocation, pipelineLogPath } from "../../pipeline/pipeline-run-link.ts";
import type { PipelineRunLocation } from "../../pipeline/pipeline-run-link.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import { closestElement } from "../../core/closest-element.ts";
import { watchShownStep } from "./pipeline-log-frame.ts";

const TAB_CLASS = "fix-ado-pipeline-tab";
const TAB_LABEL = "Pipeline";
const OPEN_ATTRIBUTE = "data-fix-ado-pipeline-tab-open";
const PAGE_SELECTOR = ".repos-pr-details-page";
const TABBAR_SELECTOR = ".repos-pr-details-page-tabbar";
/** The checks panel Azure DevOps opens from "View X checks", outside the page. */
const CHECKS_PANEL_SELECTOR = ".bolt-panel";
const RUN_LINK = 'a[href*="/_build/results?"]';
const RUN_LINK_SELECTOR = `${PAGE_SELECTOR} ${RUN_LINK}, ${CHECKS_PANEL_SELECTOR} ${RUN_LINK}`;

interface PipelineTabOptions extends PipelineTabSources {
  apiBasePath: string;
  document: Document;
}

interface PipelineTab {
  /** Adds the tab to the pull request on the page, and keeps an open tab up to date. */
  sync: (pullRequest: PullRequestRef | null) => void;
}

interface TabState {
  options: PipelineTabOptions;
  /** The pull request on the page and what the tab shows for it, or null on other pages. */
  data: PipelineTabData | null;
  isOpen: boolean;
  /** Azure DevOps's own selected tab, while the Pipeline tab took its place. */
  replacedTab: Element | null;
}

/** A tab like Azure DevOps's own. data-content keeps the width of the bold selected label. */
function createTab(document: Document): HTMLAnchorElement {
  const tab = document.createElement("a");
  tab.className = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`;
  tab.setAttribute("role", "tab");
  tab.href = "#";
  tab.innerHTML = `<span class="bolt-tab-inner-container"><span class="bolt-tab-text" data-content="${TAB_LABEL}">${TAB_LABEL}</span></span>`;
  setSelected(tab, false);
  return tab;
}

function setSelected(tab: Element, isSelected: boolean): void {
  tab.classList.toggle("selected", isSelected);
  tab.setAttribute("aria-selected", String(isSelected));
}

function isSamePullRequest(
  data: PipelineTabData | null,
  pullRequest: PullRequestRef | null,
): boolean {
  return JSON.stringify(data?.pullRequest ?? null) === JSON.stringify(pullRequest);
}

function panelOf(state: TabState, page: Element): HTMLElement | null {
  const existing = page.querySelector<HTMLElement>(`.${PANEL_CLASS}`);
  const tabbar = page.querySelector(TABBAR_SELECTOR);
  if (existing !== null || tabbar === null) {
    return existing;
  }
  const panel = createPanel(state.options.document);
  tabbar.after(panel);
  return panel;
}

function render(state: TabState): void {
  const { data } = state;
  const page = state.options.document.querySelector(PAGE_SELECTOR);
  const panel = page === null ? null : panelOf(state, page);
  if (!state.isOpen || data === null || page === null || panel === null) {
    return;
  }
  page.setAttribute(OPEN_ATTRIBUTE, "");
  const { apiBasePath } = state.options;
  const { project } = data.pullRequest;
  renderPanel(panel, {
    logPathOf: (buildId, step) =>
      pipelineLogPath(apiBasePath, project, { buildId, jobId: step.jobId, stepId: step.id }),
    onPick: (pick) => {
      data.pick = pick;
      update(state);
    },
    onRunAction: (action, key) => {
      void performRunAction(loaderOf(state, data), action, key);
    },
    onRunActionListToggle: (isOpen) => {
      data.runActionState = isOpen ? "choosing" : "idle";
      update(state);
    },
    pick: data.pick,
    runActionState: data.runActionState,
    runs: data.runs,
    shown: shownRunOfData(data),
  });
  watchLog(state, panel);
}

/**
 * The run page moved its log to another step by itself, as it does for a running run.
 * While the tab follows the run, it fetches the timeline now to catch up.
 */
function onLogStep(state: TabState, stepName: string): void {
  const { data } = state;
  const shown = data === null ? null : shownRunOfData(data);
  if (
    data === null ||
    shown === null ||
    data.pick.stepId !== null ||
    shown.step?.name === stepName
  ) {
    return;
  }
  expireTimeline(data, shown.run.buildId);
  update(state);
}

/** Watches the log in the panel's frame, once the frame is there. */
function watchLog(state: TabState, panel: Element): void {
  const frame = panel.querySelector<HTMLIFrameElement>(".fix-ado-pipeline-frame");
  if (frame !== null) {
    watchShownStep(frame, (stepName) => {
      onLogStep(state, stepName);
    });
  }
}

/** Loads into one pull request's data, and shows what comes in while the page stays on it. */
function loaderOf(state: TabState, data: PipelineTabData): PipelineTabLoader {
  return {
    data,
    onChange: () => {
      // An answer for a pull request the page has left changes nothing.
      if (state.data === data) {
        update(state);
      }
    },
    sources: state.options,
  };
}

/** Shows what came in, and loads what that makes due, such as a picked run's timeline. */
function update(state: TabState): void {
  const { data } = state;
  if (!state.isOpen || data === null) {
    return;
  }
  render(state);
  loadWhatIsDue(loaderOf(state, data));
}

function selectTab(state: TabState): void {
  const { document } = state.options;
  const tab = document.querySelector(`.${TAB_CLASS}`);
  for (const other of document.querySelectorAll("[role=tablist] [role=tab].selected")) {
    if (other !== tab) {
      state.replacedTab = other;
      setSelected(other, false);
    }
  }
  if (tab !== null) {
    setSelected(tab, true);
  }
}

/** Opens the tab on a run, and on its step when the link opened a step's log. */
function openTab(state: TabState, run: PipelineRunLocation | null): void {
  state.isOpen = true;
  if (run !== null && state.data !== null) {
    const { buildId, jobId, stepId } = run;
    state.data.pick = { buildId, folded: null, jobId, stageId: null, stepId };
  }
  selectTab(state);
  update(state);
}

function closeTab(state: TabState): void {
  const { document } = state.options;
  state.isOpen = false;
  const page = document.querySelector(PAGE_SELECTOR);
  page?.removeAttribute(OPEN_ATTRIBUTE);
  page?.querySelector(`.${PANEL_CLASS}`)?.remove();
  for (const tab of document.querySelectorAll(`.${TAB_CLASS}`)) {
    setSelected(tab, false);
  }
  if (state.replacedTab !== null) {
    setSelected(state.replacedTab, true);
    state.replacedTab = null;
  }
}

/** Closes Azure DevOps's checks panel, if the click came from there. */
function closeChecksPanel(target: EventTarget | null): void {
  const panel = closestElement(target, CHECKS_PANEL_SELECTOR);
  const closeIcon = panel?.querySelector(".bolt-panel-header .ms-Icon--Clear");
  const closeButton = closeIcon?.closest("button");
  closeButton?.click();
}

/** The run, and maybe step, a plain click on a run link of the pull request opens, or null. */
function clickedRun(event: MouseEvent, document: Document): PipelineRunLocation | null {
  const link = closestElement(event.target, RUN_LINK_SELECTOR);
  const isPlainClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  // A button inside the link, such as re-queue, belongs to Azure DevOps.
  const button = closestElement(event.target, "button, [role=button]");
  const isOnButtonInLink = button !== null && link?.contains(button) === true;
  if (
    link === null ||
    !isPlainClick ||
    isOnButtonInLink ||
    closestElement(event.target, `.${PANEL_CLASS}`) !== null
  ) {
    return null;
  }
  const url = new URL(link.getAttribute("href") ?? "", document.location.href);
  return parsePipelineRunLocation(url);
}

function onClick(state: TabState, event: MouseEvent): void {
  if (state.data === null) {
    return;
  }
  const isPipelineTab = closestElement(event.target, `.${TAB_CLASS}`) !== null;
  const run = clickedRun(event, state.options.document);
  if (isPipelineTab || run !== null) {
    event.preventDefault();
    event.stopPropagation();
    openTab(state, run);
    closeChecksPanel(event.target);
  } else if (state.isOpen && closestElement(event.target, "[role=tablist] [role=tab]") !== null) {
    closeTab(state);
  }
}

/** Adds the tab when Azure DevOps's tab bar is there. False while it is not. */
function addTab(document: Document): boolean {
  const tablist = document.querySelector(`${TABBAR_SELECTOR} [role=tablist]`);
  if (tablist === null) {
    return false;
  }
  if (tablist.querySelector(`.${TAB_CLASS}`) === null) {
    tablist.append(createTab(document));
  }
  return true;
}

function syncTab(state: TabState, pullRequest: PullRequestRef | null): void {
  if (!isSamePullRequest(state.data, pullRequest)) {
    closeTab(state);
    state.data = pullRequest === null ? null : createTabData(pullRequest);
  }
  if (state.data !== null && addTab(state.options.document) && state.isOpen) {
    // Azure DevOps may have re-rendered its tabs; this puts the open tab back.
    selectTab(state);
    update(state);
  }
}

function createPipelineTab(options: PipelineTabOptions): PipelineTab {
  const state: TabState = { data: null, isOpen: false, options, replacedTab: null };
  options.document.addEventListener(
    "click",
    (event) => {
      onClick(state, event);
    },
    { capture: true },
  );
  return {
    sync: (pullRequest) => {
      syncTab(state, pullRequest);
    },
  };
}

export type { PipelineTab };
export { createPipelineTab };
