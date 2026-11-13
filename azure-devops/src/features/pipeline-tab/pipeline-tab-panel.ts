// The content of the Pipeline tab: the run tree on the left, the shown step's log
// on the right, as the run page in a frame.
import type { PipelineTabPick, ShownRun } from "./pipeline-tab-selection.ts";
import type { RunAction, RunActionChoice, RunActionState } from "./pipeline-tab-run-action.ts";
import type { RunStage, RunStep } from "../../pipeline/pipeline-timeline.ts";
import { createIssueBox, fillIssueLink, issueSummary } from "../../pipeline/pipeline-issue-list.ts";
import { createRunTree, runDetails } from "./pipeline-tab-tree.ts";
import type { PipelineRun } from "../../pipeline/pipeline-runs.ts";
import type { RunIssue } from "../../pipeline/pipeline-issues.ts";
import type { StartableCheck } from "../../pipeline/pipeline-checks.ts";
import type { StepLog } from "./pipeline-log-frame.ts";
import { createRunAction } from "./pipeline-tab-run-action.ts";
import { runIssuesOf } from "../../pipeline/pipeline-issues.ts";
import { showStepLog } from "./pipeline-log-frame.ts";

const PANEL_CLASS = "fix-ado-pipeline-panel";
const TREE_SELECTOR = ":scope > .fix-ado-pipeline-tree";
const FRAME_SELECTOR = ":scope > .fix-ado-pipeline-frame";
const LOG_NOTE_SELECTOR = ":scope > .fix-ado-pipeline-log-note";
const ISSUES_SELECTOR = ":scope > .fix-ado-issue-box";

type RunsState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "loaded"; runs: PipelineRun[]; startableChecks: StartableCheck[] };

interface PanelContent {
  runs: RunsState;
  shown: ShownRun | null;
  /** What the owner picked, with the level of the run tree that is folded. */
  pick: PipelineTabPick;
  logPathOf: (buildId: number, step: RunStep) => string;
  onPick: (pick: PipelineTabPick) => void;
  runActionState: RunActionState;
  onRunActionListToggle: (isOpen: boolean) => void;
  onRunAction: (action: RunAction, key: string) => void;
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

function stepOf(stages: RunStage[], stepId: string | null): RunStep | undefined {
  const steps = stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
  return steps.find((step) => step.id === stepId);
}

/**
 * An issue's link. A click shows the issue's step in the tab, or its job or stage when
 * it has no step; the link itself goes to the step's log, for a new browser tab.
 */
function createIssueLink(
  { document, shown }: { document: Document; shown: ShownRun },
  issue: RunIssue,
  content: PanelContent,
): HTMLAnchorElement {
  const { buildId } = shown.run;
  const link = document.createElement("a");
  const step = stepOf(shown.stages ?? [], issue.stepId);
  link.href = step === undefined ? "#" : content.logPathOf(buildId, step);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const { jobId, stageId, stepId } = issue;
    content.onPick({ buildId, folded: null, jobId, stageId, stepId });
  });
  return fillIssueLink(link, issue);
}

/** The shown run's errors and warnings, above the log, after the tree. None without issues. */
function showIssues(panel: HTMLElement, tree: HTMLElement, content: PanelContent): void {
  panel.querySelector(ISSUES_SELECTOR)?.remove();
  const { shown } = content;
  const stages = shown?.stages ?? [];
  const issues = runIssuesOf(stages);
  if (shown === null || issues.length === 0) {
    return;
  }
  const context = { document: panel.ownerDocument, shown };
  const box = createIssueBox(context.document, {
    createLink: (issue) => createIssueLink(context, issue, content),
    details: null,
    issues,
    title: issueSummary(stages),
  });
  tree.after(box);
}

/** Puts the tree first in the panel, in place of the old one or the message. */
function placeTree(panel: HTMLElement, tree: HTMLElement): void {
  panel.querySelector(":scope > .fix-ado-pipeline-message")?.remove();
  const oldTree = panel.querySelector(TREE_SELECTOR);
  if (oldTree === null) {
    panel.prepend(tree);
  } else {
    oldTree.replaceWith(tree);
  }
}

/** Cancel while a run is busy, with the busy runs; else start, with the build checks. */
function runActionOf(
  runs: PipelineRun[],
  checks: StartableCheck[],
): { action: RunAction; choices: RunActionChoice[] } {
  const busyRuns = runs.filter((run) => run.isBusy);
  if (busyRuns.length > 0) {
    return {
      action: "cancel",
      choices: busyRuns.map((run) => ({
        details: runDetails(run),
        key: String(run.buildId),
        name: run.name,
      })),
    };
  }
  return {
    action: "start",
    choices: checks.map((check) => ({
      details: check.isRequired ? "Required" : "Optional",
      key: check.evaluationId,
      name: check.name,
    })),
  };
}

function runActionElements(
  panel: HTMLElement,
  { runs, startableChecks }: { runs: PipelineRun[]; startableChecks: StartableCheck[] },
  content: PanelContent,
): HTMLElement[] {
  return (
    createRunAction({
      ...runActionOf(runs, startableChecks),
      document: panel.ownerDocument,
      onPick: content.onRunAction,
      onToggleList: content.onRunActionListToggle,
      state: content.runActionState,
    }) ?? []
  );
}

function showRun(
  panel: HTMLElement,
  loaded: { runs: PipelineRun[]; startableChecks: StartableCheck[] },
  content: PanelContent,
): void {
  const { shown } = content;
  if (shown === null) {
    message(panel, "This pull request has no pipeline runs.");
    panel.prepend(...runActionElements(panel, loaded, content));
    return;
  }
  const tree = createRunTree({
    document: panel.ownerDocument,
    onPick: content.onPick,
    pick: content.pick,
    runs: loaded.runs,
    shown,
  });
  tree.prepend(...runActionElements(panel, loaded, content));
  placeTree(panel, tree);
  showIssues(panel, tree, content);
  showLog(panel, shown, content);
}

/** What the panel shows. A render with the same key leaves the page alone. */
function renderKey({ pick, runActionState, runs, shown }: PanelContent): string {
  return JSON.stringify([runs, shown, pick, runActionState]);
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
    showRun(panel, content.runs, content);
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
