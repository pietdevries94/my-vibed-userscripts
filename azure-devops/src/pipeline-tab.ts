// The Pipeline tab on a pull request. It shows the pull request's pipeline runs in the
// pull request itself, and run links on the pull request open there too.
import { PANEL_CLASS, createPanel, renderPanel } from "./pipeline-tab-panel.ts";
import { parsePipelineRunLocation, pipelineStepsPath } from "./pipeline-run-link.ts";
import type { ChecksState } from "./pipeline-tab-panel.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import { closestElement } from "./closest-element.ts";
import { pipelineChecksOf } from "./pipeline-checks.ts";

const TAB_CLASS = "fix-ado-pipeline-tab";
const TAB_LABEL = "Pipeline";
const OPEN_ATTRIBUTE = "data-fix-ado-pipeline-tab-open";
const PAGE_SELECTOR = ".repos-pr-details-page";
const TABBAR_SELECTOR = ".repos-pr-details-page-tabbar";
const RUN_LINK_SELECTOR = `${PAGE_SELECTOR} a[href*="/_build/results?"]`;
/** While the tab is open, the checks are fetched again after this long. */
const CHECKS_REFRESH_MS = 30_000;

interface PipelineTabOptions {
  apiBasePath: string;
  document: Document;
  getEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluation[]>;
  now: () => number;
}

interface PipelineTab {
  /** Adds the tab to the pull request on the page, and keeps an open tab up to date. */
  sync: (pullRequest: PullRequestRef | null) => void;
}

interface TabState {
  options: PipelineTabOptions;
  pullRequest: PullRequestRef | null;
  isOpen: boolean;
  /** The run the owner picked, or null for the newest. */
  selectedBuildId: number | null;
  checks: ChecksState;
  checksLoadedAt: number;
  /** Azure DevOps's own selected tab, while the Pipeline tab took its place. */
  replacedTab: Element | null;
}

/** A tab like Azure DevOps's own. data-content keeps the width of the bold selected label. */
function createTab(document: Document): HTMLAnchorElement {
  const tab = document.createElement("a");
  tab.className = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`;
  tab.setAttribute("role", "tab");
  tab.href = "#";
  tab.innerHTML = `<span class="bolt-tab-text" data-content="${TAB_LABEL}">${TAB_LABEL}</span>`;
  setSelected(tab, false);
  return tab;
}

function setSelected(tab: Element, isSelected: boolean): void {
  tab.classList.toggle("selected", isSelected);
  tab.setAttribute("aria-selected", String(isSelected));
}

function isSamePullRequest(first: PullRequestRef | null, second: PullRequestRef | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
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
  const page = state.options.document.querySelector(PAGE_SELECTOR);
  const panel = page === null ? null : panelOf(state, page);
  if (!state.isOpen || state.pullRequest === null || page === null || panel === null) {
    return;
  }
  page.setAttribute(OPEN_ATTRIBUTE, "");
  const { project, pullRequestId } = state.pullRequest;
  renderPanel(panel, {
    checks: state.checks,
    onPick: (buildId) => {
      state.selectedBuildId = buildId;
      render(state);
    },
    pullRequestId,
    selectedBuildId: state.selectedBuildId,
    stepsPath: (buildId) => pipelineStepsPath(state.options.apiBasePath, project, buildId),
  });
}

async function loadChecks(state: TabState): Promise<void> {
  const loadingFor = state.pullRequest;
  if (loadingFor === null) {
    return;
  }
  state.checksLoadedAt = state.options.now();
  try {
    const evaluations = await state.options.getEvaluations(loadingFor);
    if (isSamePullRequest(loadingFor, state.pullRequest)) {
      state.checks = { checks: pipelineChecksOf(evaluations), kind: "loaded" };
    }
  } catch {
    // Keep the checks already shown; a later refresh tries again.
    state.checks = state.checks.kind === "loaded" ? state.checks : { kind: "failed" };
  }
  render(state);
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

function openTab(state: TabState, buildId: number | null): void {
  state.isOpen = true;
  state.selectedBuildId = buildId ?? state.selectedBuildId;
  selectTab(state);
  render(state);
  void loadChecks(state);
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

/** The run a plain click on a run link of the pull request opens, or null. */
function clickedRunBuildId(event: MouseEvent, document: Document): number | null {
  const link = closestElement(event.target, RUN_LINK_SELECTOR);
  const isPlainClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  if (link === null || !isPlainClick || closestElement(event.target, `.${PANEL_CLASS}`) !== null) {
    return null;
  }
  const url = new URL(link.getAttribute("href") ?? "", document.location.href);
  return parsePipelineRunLocation(url)?.buildId ?? null;
}

function onClick(state: TabState, event: MouseEvent): void {
  if (state.pullRequest === null) {
    return;
  }
  const isPipelineTab = closestElement(event.target, `.${TAB_CLASS}`) !== null;
  const runBuildId = clickedRunBuildId(event, state.options.document);
  if (isPipelineTab || runBuildId !== null) {
    event.preventDefault();
    event.stopPropagation();
    openTab(state, runBuildId);
  } else if (state.isOpen && closestElement(event.target, "[role=tablist] [role=tab]") !== null) {
    closeTab(state);
  }
}

function switchPullRequest(state: TabState, pullRequest: PullRequestRef | null): void {
  closeTab(state);
  state.pullRequest = pullRequest;
  state.selectedBuildId = null;
  state.checks = { kind: "loading" };
  state.checksLoadedAt = Number.NEGATIVE_INFINITY;
}

/** Azure DevOps may re-render its tabs or content; this puts the open tab back. */
function refreshOpenTab(state: TabState): void {
  selectTab(state);
  render(state);
  if (state.options.now() - state.checksLoadedAt >= CHECKS_REFRESH_MS) {
    void loadChecks(state);
  }
}

function syncTab(state: TabState, pullRequest: PullRequestRef | null): void {
  if (!isSamePullRequest(pullRequest, state.pullRequest)) {
    switchPullRequest(state, pullRequest);
  }
  const { document } = state.options;
  const tablist = document.querySelector(`${TABBAR_SELECTOR} [role=tablist]`);
  if (state.pullRequest === null || tablist === null) {
    return;
  }
  if (tablist.querySelector(`.${TAB_CLASS}`) === null) {
    tablist.append(createTab(document));
  }
  if (state.isOpen) {
    refreshOpenTab(state);
  }
}

function createPipelineTab(options: PipelineTabOptions): PipelineTab {
  const state: TabState = {
    checks: { kind: "loading" },
    checksLoadedAt: Number.NEGATIVE_INFINITY,
    isOpen: false,
    options,
    pullRequest: null,
    replacedTab: null,
    selectedBuildId: null,
  };
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
