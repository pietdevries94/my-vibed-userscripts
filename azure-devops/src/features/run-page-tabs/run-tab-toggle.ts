// A switch in a run page's tab bar, "Show this tab in pull requests", for the selected
// tab of this run's pipeline. The run page does not name its pipeline, so the switch
// reads it once from the run, and stays disabled until it knows.
import type { RunTab, RunTabStorage } from "./run-tab-store.ts";
import { isSameRunTab, runTabViewOf } from "./run-tab-store.ts";
import type { BuildPipeline } from "../../pipeline/build-requests.ts";
import { parsePipelineRunLocation } from "../../pipeline/pipeline-run-link.ts";

const TABBAR_SELECTOR = ".run-details-page > .bolt-tabbar";
const SELECTED_TAB_SELECTOR = '[role=tablist] [role=tab][aria-selected="true"]';
const TOGGLE_CLASS = "fix-ado-run-tab-toggle";
const LABEL = "Show this tab in pull requests";
const FAILED_TITLE = "Could not read this run's pipeline. Reload to try again.";

interface RunTabToggleOptions {
  document: Document;
  storage: RunTabStorage;
  getBuildPipeline: (project: string, buildId: number) => Promise<BuildPipeline>;
}

interface RunTabToggle {
  /** Adds the switch to a run page's tab bar, and shows the selected tab's state. */
  sync: () => void;
}

/** The run's pipeline: being read, known, or not readable. */
type PipelineLookup =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "known"; pipeline: BuildPipeline }
  | { kind: "failed" };

interface ToggleState {
  options: RunTabToggleOptions;
  lookup: PipelineLookup;
}

/** The tab the switch is for: the selected tab, of the run's pipeline once that is known. */
function shownTabOf(tabbar: Element, lookup: PipelineLookup): RunTab | null {
  const selected = tabbar.querySelector(SELECTED_TAB_SELECTOR);
  const view = selected === null ? null : runTabViewOf(selected);
  if (selected === null || view === null || lookup.kind !== "known") {
    return null;
  }
  const label = selected.querySelector(".bolt-tab-text")?.textContent.trim() ?? view;
  const { id, name } = lookup.pipeline;
  return { label, pipelineId: id, pipelineName: name, view };
}

function createPill(document: Document): HTMLElement {
  const pill = Object.assign(document.createElement("span"), {
    className: "fix-ado-run-tab-toggle-pill",
  });
  pill.setAttribute("aria-hidden", "true");
  pill.append(
    Object.assign(document.createElement("span"), { className: "fix-ado-run-tab-toggle-knob" }),
  );
  return pill;
}

function createToggle(document: Document): HTMLButtonElement {
  const toggle = Object.assign(document.createElement("button"), {
    className: TOGGLE_CLASS,
    type: "button",
  });
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", "false");
  const text = Object.assign(document.createElement("span"), {
    className: "fix-ado-run-tab-toggle-text",
    textContent: LABEL,
  });
  toggle.append(createPill(document), text);
  return toggle;
}

/** Turns the tab on or off for pull requests, and saves that. */
function flip(state: ToggleState, tabbar: Element): void {
  const tab = shownTabOf(tabbar, state.lookup);
  if (tab === null) {
    return;
  }
  const { storage } = state.options;
  const saved = storage.load();
  const others = saved.filter((other) => !isSameRunTab(other, tab));
  storage.save(others.length === saved.length ? [...saved, tab] : others);
}

function toggleIn(state: ToggleState, tabbar: Element): HTMLButtonElement {
  const existing = tabbar.querySelector<HTMLButtonElement>(`:scope > .${TOGGLE_CLASS}`);
  if (existing !== null) {
    return existing;
  }
  const toggle = createToggle(state.options.document);
  toggle.addEventListener("click", () => {
    flip(state, tabbar);
    showState(state, tabbar, toggle);
  });
  tabbar.append(toggle);
  return toggle;
}

/** Writes only what changed, so the page's own observers stay quiet. */
function showState(state: ToggleState, tabbar: Element, toggle: HTMLButtonElement): void {
  const tab = shownTabOf(tabbar, state.lookup);
  const isOn =
    tab !== null && state.options.storage.load().some((other) => isSameRunTab(other, tab));
  if (toggle.getAttribute("aria-checked") !== String(isOn)) {
    toggle.setAttribute("aria-checked", String(isOn));
  }
  if (toggle.disabled !== (tab === null)) {
    toggle.disabled = tab === null;
  }
  const title = state.lookup.kind === "failed" ? FAILED_TITLE : "";
  if (toggle.title !== title) {
    toggle.title = title;
  }
}

/** Reads the run's pipeline once, then shows the switch again. */
function lookUpPipeline(state: ToggleState, sync: () => void): void {
  const { document, getBuildPipeline } = state.options;
  const run = parsePipelineRunLocation(document.location);
  const project = decodeURIComponent(
    document.location.pathname.split("/_build/")[0]?.split("/").pop() ?? "",
  );
  if (state.lookup.kind !== "idle" || run === null || project === "") {
    return;
  }
  state.lookup = { kind: "reading" };
  getBuildPipeline(project, run.buildId).then(
    (pipeline) => {
      state.lookup = { kind: "known", pipeline };
      sync();
    },
    () => {
      state.lookup = { kind: "failed" };
      sync();
    },
  );
}

function createRunTabToggle(options: RunTabToggleOptions): RunTabToggle {
  const state: ToggleState = { lookup: { kind: "idle" }, options };
  const sync = (): void => {
    const tabbar = options.document.querySelector(TABBAR_SELECTOR);
    if (tabbar === null || tabbar.querySelector(SELECTED_TAB_SELECTOR) === null) {
      return;
    }
    lookUpPipeline(state, sync);
    showState(state, tabbar, toggleIn(state, tabbar));
  };
  return { sync };
}

export type { RunTabToggle };
export { createRunTabToggle };
