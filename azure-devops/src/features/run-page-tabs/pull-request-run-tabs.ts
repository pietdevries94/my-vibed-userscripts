// The run page tabs the owner turned on, as tabs of a pull request: each shows that tab of
// its pipeline's latest run on the pull request. A pick hides the page's content, as the
// Pipeline tab does; any other tab closes it.
import { PANEL_CLASS, TAB_CLASS, setSelected, showPanel, showTabs } from "./run-tab-elements.ts";
import { closestElement, closestHtmlElement } from "../../core/closest-element.ts";
import { OWN_TAB_ATTRIBUTE } from "../pipeline-tab/pipeline-tab-element.ts";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { PullRequestRunTab } from "./pull-request-run-tabs-data.ts";
import type { RunTab } from "./run-tab-store.ts";
import { pipelineRunPath } from "../../pipeline/pipeline-run-link.ts";
import { pullRequestRunTabsOf } from "./pull-request-run-tabs-data.ts";
import { runTabPath } from "./run-tab-store.ts";

/** The checks and runs are fetched again after this long. */
const REFRESH_MS = 30_000;
const PAGE_SELECTOR = ".repos-pr-details-page";
const TABLIST_SELECTOR = ".repos-pr-details-page-tabbar [role=tablist]";
const OPEN_ATTRIBUTE = "data-fix-ado-run-tab-open";

interface PullRequestRunTabsOptions {
  apiBasePath: string;
  document: Document;
  loadRunTabs: () => RunTab[];
  getEvaluations: (pullRequest: PullRequestRef) => Promise<PolicyEvaluation[]>;
  getPullRequestBuilds: (project: string, pullRequestId: number) => Promise<PullRequestBuild[]>;
  now: () => number;
}

interface PullRequestRunTabs {
  /** Shows the tabs of the pull request on the page, and fetches what is due when `canFetch`. */
  sync: (pullRequest: PullRequestRef | null, canFetch: boolean) => void;
}

/** What the tabs know of one pull request. */
interface RunTabsData {
  pullRequest: PullRequestRef;
  evaluations: PolicyEvaluation[] | null;
  builds: PullRequestBuild[];
  loadedAt: number;
}

interface RunTabsState {
  options: PullRequestRunTabsOptions;
  data: RunTabsData | null;
  /** The key of the open tab, or null. */
  openKey: string | null;
}

function runTabsOf({ data, options }: RunTabsState): PullRequestRunTab[] {
  return data?.evaluations === null || data === null
    ? []
    : pullRequestRunTabsOf(options.loadRunTabs(), data.evaluations, data.builds);
}

function closeTab(state: RunTabsState): void {
  const { document } = state.options;
  state.openKey = null;
  const page = document.querySelector(PAGE_SELECTOR);
  page?.removeAttribute(OPEN_ATTRIBUTE);
  page?.querySelector(`:scope > .${PANEL_CLASS}`)?.remove();
  for (const tab of document.querySelectorAll(`.${TAB_CLASS}[aria-selected="true"]`)) {
    setSelected(tab, false);
  }
}

/** The open tab's panel; closes the tab when it went or lost its run. */
function showOpenTab(
  state: RunTabsState,
  page: Element,
  shown: { runTabs: PullRequestRunTab[]; tabs: HTMLElement[] },
): void {
  const index = shown.runTabs.findIndex(({ key }) => key === state.openKey);
  const [runTab, tab] = [shown.runTabs[index], shown.tabs[index]];
  const buildId = runTab?.buildId ?? null;
  if (state.data === null || runTab === undefined || tab === undefined || buildId === null) {
    closeTab(state);
    return;
  }
  const { apiBasePath } = state.options;
  const runPath = pipelineRunPath(apiBasePath, state.data.pullRequest.project, buildId);
  page.setAttribute(OPEN_ATTRIBUTE, "");
  showPanel(page, tab, { path: runTabPath(runPath, runTab.tab.view), runTab });
}

/** Shows the tabs, and the open one's panel. */
function render(state: RunTabsState): void {
  const { document } = state.options;
  const tablist = document.querySelector(TABLIST_SELECTOR);
  const page = document.querySelector(PAGE_SELECTOR);
  if (tablist === null || page === null || state.data === null) {
    return;
  }
  const runTabs = runTabsOf(state);
  const tabs = showTabs(tablist, runTabs);
  if (state.openKey !== null) {
    showOpenTab(state, page, { runTabs, tabs });
  }
}

function openTab(state: RunTabsState, tab: HTMLElement): void {
  const { document } = state.options;
  const selector = `${TABLIST_SELECTOR} [role=tab][aria-selected="true"]`;
  for (const other of document.querySelectorAll(selector)) {
    setSelected(other, false);
  }
  setSelected(tab, true);
  state.openKey = tab.dataset.fixAdoRunTab ?? null;
  render(state);
}

/**
 * Another tab closes the open one. Azure DevOps does not select a tab it thinks is
 * selected already, such as Overview, so the script selects it.
 */
function closeForOtherTab(state: RunTabsState, other: Element): void {
  closeTab(state);
  if (!other.hasAttribute(OWN_TAB_ATTRIBUTE)) {
    setSelected(other, true);
  }
}

function onClick(state: RunTabsState, event: MouseEvent): void {
  const tab = closestHtmlElement(event.target, `.${TAB_CLASS}`);
  const other = closestElement(event.target, `${TABLIST_SELECTOR} [role=tab]`);
  if (tab === null) {
    if (state.openKey !== null && other !== null) {
      closeForOtherTab(state, other);
    }
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (tab.getAttribute("aria-disabled") !== "true") {
    openTab(state, tab);
  }
}

async function loadChecksAndRuns(state: RunTabsState, data: RunTabsData): Promise<void> {
  const { options } = state;
  data.loadedAt = options.now();
  const { project, pullRequestId } = data.pullRequest;
  try {
    const [evaluations, builds] = await Promise.all([
      options.getEvaluations(data.pullRequest),
      options.getPullRequestBuilds(project, pullRequestId),
    ]);
    data.evaluations = evaluations;
    data.builds = builds;
  } catch {
    // The tabs keep what they showed; the next refresh tries again.
  }
  if (state.data === data) {
    render(state);
  }
}

function syncRunTabs(
  state: RunTabsState,
  pullRequest: PullRequestRef | null,
  canFetch: boolean,
): void {
  if (JSON.stringify(state.data?.pullRequest ?? null) !== JSON.stringify(pullRequest)) {
    closeTab(state);
    state.data =
      pullRequest === null
        ? null
        : { builds: [], evaluations: null, loadedAt: Number.NEGATIVE_INFINITY, pullRequest };
  }
  const { data, options } = state;
  if (data === null) {
    return;
  }
  const isDue = options.now() - data.loadedAt >= REFRESH_MS;
  if (canFetch && isDue && options.loadRunTabs().length > 0) {
    void loadChecksAndRuns(state, data);
  }
  render(state);
}

function createPullRequestRunTabs(options: PullRequestRunTabsOptions): PullRequestRunTabs {
  const state: RunTabsState = { data: null, openKey: null, options };
  options.document.addEventListener(
    "click",
    (event) => {
      onClick(state, event);
    },
    { capture: true },
  );
  return {
    sync: (pullRequest, canFetch) => {
      syncRunTabs(state, pullRequest, canFetch);
    },
  };
}

export type { PullRequestRunTabs };
export { createPullRequestRunTabs };
