// The content of the Pipeline tab: the run tree on the left, the shown step's log
// on the right, as the run page in a frame.
import type { PipelineTabPick, ShownRun } from "./pipeline-tab-selection.ts";
import type { PipelineRun } from "./pipeline-runs.ts";
import type { RunStep } from "./pipeline-timeline.ts";
import type { StepLog } from "./pipeline-log-frame.ts";
import { createRunTree } from "./pipeline-tab-tree.ts";
import { showStepLog } from "./pipeline-log-frame.ts";

const PANEL_CLASS = "fix-ado-pipeline-panel";
const TREE_SELECTOR = ":scope > .fix-ado-pipeline-tree";
const FRAME_SELECTOR = ":scope > .fix-ado-pipeline-frame";
const LOG_NOTE_SELECTOR = ":scope > .fix-ado-pipeline-log-note";

type RunsState = { kind: "loading" } | { kind: "failed" } | { kind: "loaded"; runs: PipelineRun[] };

interface PanelContent {
  runs: RunsState;
  shown: ShownRun | null;
  /** What the owner picked, with the level of the run tree that is folded. */
  pick: PipelineTabPick;
  logPathOf: (buildId: number, step: RunStep) => string;
  onPick: (pick: PipelineTabPick) => void;
}

function message(panel: HTMLElement, text: string): void {
  const note = panel.ownerDocument.createElement("p");
  note.className = "fix-ado-pipeline-message";
  note.textContent = text;
  panel.replaceChildren(note);
}

/**
 * The frame of the panel. It is created once and never moved: a frame that leaves
 * the page loads its run again.
 */
function frameOf(panel: HTMLElement): HTMLIFrameElement {
  const existing = panel.querySelector<HTMLIFrameElement>(FRAME_SELECTOR);
  if (existing !== null) {
    return existing;
  }
  const frame = panel.ownerDocument.createElement("iframe");
  frame.className = "fix-ado-pipeline-frame";
  frame.title = "Step log";
  panel.append(frame);
  return frame;
}

/** The note in place of the log while there is no step to show. Null removes it. */
function showLogNote(panel: HTMLElement, text: string | null): void {
  let note = panel.querySelector<HTMLElement>(LOG_NOTE_SELECTOR);
  if (text === null) {
    note?.remove();
    return;
  }
  if (note === null) {
    note = panel.ownerDocument.createElement("p");
    note.className = "fix-ado-pipeline-log-note";
    panel.append(note);
  }
  note.textContent = text;
}

function stepLogOf(shown: ShownRun, step: RunStep, content: PanelContent): StepLog {
  const { buildId } = shown.run;
  const jobName = shown.stage?.jobs.find((job) => job.id === step.jobId)?.name ?? "";
  return { buildId, jobName, path: content.logPathOf(buildId, step), stepName: step.name };
}

function showLog(panel: HTMLElement, shown: ShownRun, content: PanelContent): void {
  const { step } = shown;
  if (step === null) {
    panel.querySelector(FRAME_SELECTOR)?.setAttribute("hidden", "");
    showLogNote(panel, shown.stages === null ? "Loading steps…" : "This run has no steps yet.");
    return;
  }
  showLogNote(panel, null);
  const frame = frameOf(panel);
  frame.removeAttribute("hidden");
  showStepLog(frame, stepLogOf(shown, step, content));
}

/** Puts the tree first in the panel, in place of the old one. */
function placeTree(panel: HTMLElement, tree: HTMLElement): void {
  const oldTree = panel.querySelector(TREE_SELECTOR);
  if (oldTree === null) {
    panel.prepend(tree);
  } else {
    oldTree.replaceWith(tree);
  }
}

function showRun(panel: HTMLElement, runs: PipelineRun[], content: PanelContent): void {
  const { shown } = content;
  if (shown === null) {
    message(panel, "This pull request has no pipeline runs.");
    return;
  }
  panel.querySelector(":scope > .fix-ado-pipeline-message")?.remove();
  const tree = createRunTree({
    document: panel.ownerDocument,
    onPick: content.onPick,
    pick: content.pick,
    runs,
    shown,
  });
  placeTree(panel, tree);
  showLog(panel, shown, content);
}

/** What the panel shows. A render with the same key leaves the page alone. */
function renderKey({ pick, runs, shown }: PanelContent): string {
  return JSON.stringify([runs, shown, pick]);
}

function renderPanel(panel: HTMLElement, content: PanelContent): void {
  const key = renderKey(content);
  if (panel.dataset.fixAdoRendered === key) {
    return;
  }
  panel.dataset.fixAdoRendered = key;
  if (content.runs.kind === "loading") {
    message(panel, "Loading pipeline runs…");
  } else if (content.runs.kind === "failed") {
    message(panel, "Could not load the pipeline runs.");
  } else {
    showRun(panel, content.runs.runs, content);
  }
}

function createPanel(document: Document): HTMLElement {
  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.setAttribute("role", "tabpanel");
  return panel;
}

export type { PanelContent, RunsState };
export { PANEL_CLASS, createPanel, renderPanel };
