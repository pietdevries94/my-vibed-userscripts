// The left column of the Pipeline tab: the runs, the shown run's stages, and the
// shown stage's jobs with their steps. Clicking the current run, stage or job folds
// it; clicking it again opens it.
import type { PipelineRun, RunStatus } from "./pipeline-runs.ts";
import type { PipelineTabPick, ShownRun, TreeLevel } from "./pipeline-tab-selection.ts";
import type { RunJob, RunStage } from "./pipeline-timeline.ts";
import { closestElement } from "./closest-element.ts";
import { createStatusIcon } from "./pipeline-status-icon.ts";
import { recordStatusOf } from "./pipeline-timeline.ts";

/** Azure DevOps's name for the one stage of a pipeline without stages. */
const DEFAULT_STAGE_NAME = "__default";
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
const NAME_CLASS = "fix-ado-pipeline-item-name";

interface TreeItem {
  className: string;
  name: string;
  details?: string;
  status: RunStatus | null;
  isCurrent: boolean;
  /** What a click on an item that is not current picks. */
  pick: PipelineTabPick;
  /** The level a click on the current item folds, or null for a step. */
  level: TreeLevel | null;
}

/** What every part of the tree needs. */
interface TreeContext {
  document: Document;
  shown: ShownRun;
  /** What the owner picked, with the level that is folded now. */
  pick: PipelineTabPick;
  onPick: (pick: PipelineTabPick) => void;
}

function textElement(document: Document, className: string, text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function createItemText(document: Document, item: TreeItem): HTMLElement {
  const text = textElement(document, "fix-ado-pipeline-item-text", "");
  text.append(textElement(document, NAME_CLASS, item.name));
  if (item.details !== undefined) {
    text.append(textElement(document, "fix-ado-pipeline-item-details", item.details));
  }
  return text;
}

/** The pick of a click on the current item: the same pick, folded or opened at its level. */
function foldPick(context: TreeContext, level: TreeLevel): PipelineTabPick {
  const { pick } = context;
  return { ...pick, folded: pick.folded === level ? null : level };
}

function createItem(context: TreeContext, item: TreeItem): HTMLButtonElement {
  const { document } = context;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `fix-ado-pipeline-item ${item.className}`;
  button.setAttribute("aria-current", String(item.isCurrent));
  const text = createItemText(document, item);
  const icon =
    item.status === null ? [] : [createStatusIcon(document, item.status.status, item.status.label)];
  button.append(...icon, text);
  button.addEventListener("click", () => {
    const { level } = item;
    context.onPick(item.isCurrent && level !== null ? foldPick(context, level) : item.pick);
  });
  return button;
}

function requiredLabel(isRequired: boolean): string {
  return isRequired ? "Required" : "Optional";
}

/** Required or Optional for a current check, else the run's number; then when it started. */
function runDetails(run: PipelineRun): string {
  const kind =
    run.isRequired === null ? `#${run.buildNumber ?? run.buildId}` : requiredLabel(run.isRequired);
  return run.startedAt === null
    ? kind
    : `${kind} · ${new Date(run.startedAt).toLocaleString([], DATE_FORMAT)}`;
}

function group(document: Document, className: string, children: Node[]): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.append(...children);
  return element;
}

function createJobSteps(context: TreeContext, job: RunJob): HTMLElement {
  const { run, stage, step } = context.shown;
  const steps = job.steps.map((candidate) =>
    createItem(context, {
      className: "fix-ado-pipeline-step",
      isCurrent: candidate.id === step?.id,
      level: null,
      name: candidate.name,
      pick: {
        buildId: run.buildId,
        folded: null,
        jobId: candidate.jobId,
        stageId: stage?.id ?? null,
        stepId: candidate.id,
      },
      status: recordStatusOf(candidate),
    }),
  );
  return group(context.document, "fix-ado-pipeline-steps", steps);
}

/** A job row, then its steps. Picking a job shows its running step, else its first failed one, else its first. */
function createJob(context: TreeContext, job: RunJob): HTMLElement[] {
  const { shown } = context;
  const isCurrent = shown.step?.jobId === job.id;
  const item = createItem(context, {
    className: "fix-ado-pipeline-job",
    isCurrent,
    level: "job",
    name: job.name,
    pick: {
      buildId: shown.run.buildId,
      folded: null,
      jobId: job.id,
      stageId: shown.stage?.id ?? null,
      stepId: null,
    },
    status: recordStatusOf(job),
  });
  const isFolded = isCurrent && context.pick.folded === "job";
  return isFolded ? [item] : [item, createJobSteps(context, job)];
}

function createJobs(context: TreeContext): HTMLElement {
  const jobs = context.shown.stage?.jobs ?? [];
  const items = jobs.flatMap((job) => createJob(context, job));
  return group(context.document, "fix-ado-pipeline-jobs", items);
}

function stageName(stage: RunStage): string {
  return stage.name === DEFAULT_STAGE_NAME ? "Jobs" : stage.name;
}

function createStage(context: TreeContext, stage: RunStage): HTMLElement[] {
  const { shown } = context;
  const isCurrent = stage.id === shown.stage?.id;
  const item = createItem(context, {
    className: "fix-ado-pipeline-stage",
    isCurrent,
    level: "stage",
    name: stageName(stage),
    pick: {
      buildId: shown.run.buildId,
      folded: null,
      jobId: null,
      stageId: stage.id,
      stepId: null,
    },
    status: recordStatusOf(stage),
  });
  const isOpen = isCurrent && context.pick.folded !== "stage";
  return isOpen ? [item, createJobs(context)] : [item];
}

function createStages(context: TreeContext): HTMLElement {
  const { document, shown } = context;
  if (shown.stages === null) {
    return textElement(document, "fix-ado-pipeline-note", "Loading stages…");
  }
  if (shown.stages.length === 0) {
    return textElement(document, "fix-ado-pipeline-note", "No stages yet.");
  }
  const items = shown.stages.flatMap((stage) => createStage(context, stage));
  return group(document, "fix-ado-pipeline-stages", items);
}

function createRun(context: TreeContext, run: PipelineRun): HTMLElement[] {
  const isCurrent = run.buildId === context.shown.run.buildId;
  const item = createItem(context, {
    className: "fix-ado-pipeline-run",
    details: runDetails(run),
    isCurrent,
    level: "run",
    name: run.name,
    pick: { buildId: run.buildId, folded: null, jobId: null, stageId: null, stepId: null },
    status: run.status,
  });
  const isOpen = isCurrent && context.pick.folded !== "run";
  return isOpen ? [item, createStages(context)] : [item];
}

/** Gives a row whose name does not fit its full name as a tooltip, when the pointer gets there. */
function showCutOffNames(tree: HTMLElement): void {
  tree.addEventListener("mouseover", (event) => {
    const row = closestElement(event.target, ".fix-ado-pipeline-item");
    const name = row?.querySelector(`.${NAME_CLASS}`);
    if (row === null || name === null || name === undefined) {
      return;
    }
    if (name.scrollWidth > name.clientWidth) {
      row.setAttribute("title", name.textContent);
    } else {
      row.removeAttribute("title");
    }
  });
}

function createRunTree(context: TreeContext & { runs: PipelineRun[] }): HTMLElement {
  const items = context.runs.flatMap((run) => createRun(context, run));
  const tree = group(context.document, "fix-ado-pipeline-tree", items);
  tree.setAttribute("role", "navigation");
  tree.setAttribute("aria-label", "Pipeline runs");
  showCutOffNames(tree);
  return tree;
}

export type { TreeContext };
export { createRunTree, runDetails };
