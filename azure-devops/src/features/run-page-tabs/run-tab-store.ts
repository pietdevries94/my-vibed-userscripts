// The run page tabs the owner turned on to show in pull requests, per pipeline: such as
// Code Coverage of one pipeline, or an extension's tab. A tab is known by its view, as
// the run page's URL names it.

/** A run page tab of one pipeline, with the label its tab bar shows. */
interface RunTab {
  pipelineId: number;
  pipelineName: string;
  /** Such as "codecoverage-tab". */
  view: string;
  label: string;
}

interface RunTabStorage {
  load: () => RunTab[];
  save: (tabs: RunTab[]) => void;
}

/** Azure DevOps's id of a run page tab: this prefix, then the tab's view. */
const RUN_TAB_ID_PREFIX = "__bolt-tab-";

/** The view of a tab in a run page's tab bar, or null for another element. */
function runTabViewOf(tab: Element): string | null {
  return tab.id.startsWith(RUN_TAB_ID_PREFIX) ? tab.id.slice(RUN_TAB_ID_PREFIX.length) : null;
}

/** The tabs in a run page's tab bar, by their views. Empty while the tab bar loads. */
function runTabViewsIn(document: Document): string[] {
  const tabs = document.querySelectorAll(
    ".run-details-page .bolt-tabbar [role=tablist] [role=tab]",
  );
  return [...tabs].map((tab) => runTabViewOf(tab)).filter((view) => view !== null);
}

/** A run's page on one of its tabs. */
function runTabPath(runPath: string, view: string): string {
  return `${runPath}&view=${encodeURIComponent(view)}`;
}

function isSameRunTab(first: RunTab, second: RunTab): boolean {
  return first.pipelineId === second.pipelineId && first.view === second.view;
}

export type { RunTab, RunTabStorage };
export { isSameRunTab, runTabPath, runTabViewOf, runTabViewsIn };
