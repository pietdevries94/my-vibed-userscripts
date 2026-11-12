// The left column of the Pipeline tab: the runs, the shown run's stages, and the
// shown stage's jobs with their steps. Clicking the current run, stage or job folds
// it; clicking it again opens it.
import type { PipelineTabPick, ShownRun, TreeLevel } from "./pipeline-tab-selection.ts";
import type { RunJob, RunStage } from "./pipeline-timeline.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import type { PipelineStatus } from "./pipeline-status.ts";
import { closestElement } from "./closest-element.ts";
import { createStatusIcon } from "./pipeline-status-icon.ts";
import { recordStatusOf } from "./pipeline-timeline.ts";

/** Azure DevOps's name for the one stage of a pipeline without stages. */
const DEFAULT_STAGE_NAME = "__default";
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
const NAME_CLASS = "fix-ado-pipeline-item-name";

/** The icon of an item. Without a label, the icon's own label for the status. */
interface ItemStatus {
  status: PipelineStatus;
  label?: string;
}

interface TreeItem {
  className: string;
  name: string;
  details?: string;
  status: ItemStatus | null;
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
  /** The level that is folded now, or null. */
  folded: TreeLevel | null;
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

/** The pick of a click on the current item: the same selection, folded or opened at its level. */
function foldPick(context: TreeContext, level: TreeLevel): PipelineTabPick {
  const { check, stage, step } = context.shown;
  return {
    buildId: check.buildId,
    folded: context.folded === level ? null : level,
    stageId: stage?.id ?? null,
    stepId: step?.id ?? null,
  };
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

function checkDetails(check: PipelineCheck): string {
  const required = check.isRequired ? "Required" : "Optional";
  return check.startedAt === null
    ? required
    : `${required} · ${new Date(check.startedAt).toLocaleString([], DATE_FORMAT)}`;
}

function checkStatus(check: PipelineCheck): ItemStatus | null {
  return check.status === null ? null : { status: check.status };
}

function group(document: Document, className: string, children: Node[]): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.append(...children);
  return element;
}

function createJobSteps(context: TreeContext, job: RunJob): HTMLElement {
  const { check, stage, step } = context.shown;
  const steps = job.steps.map((candidate) =>
    createItem(context, {
      className: "fix-ado-pipeline-step",
      isCurrent: candidate.id === step?.id,
      level: null,
      name: candidate.name,
      pick: {
        buildId: check.buildId,
        folded: null,
        stageId: stage?.id ?? null,
        stepId: candidate.id,
      },
      status: recordStatusOf(candidate),
    }),
  );
  return group(context.document, "fix-ado-pipeline-steps", steps);
}

/** A job row, then its steps. Picking a job shows its first failed step, else its first. */
function createJob(context: TreeContext, job: RunJob): HTMLElement[] {
  const { shown } = context;
  const firstStep = job.steps.find((step) => step.result === "failed") ?? job.steps[0];
  const isCurrent = shown.step?.jobId === job.id;
  const item = createItem(context, {
    className: "fix-ado-pipeline-job",
    isCurrent,
    level: "job",
    name: job.name,
    pick: {
      buildId: shown.check.buildId,
      folded: null,
      stageId: shown.stage?.id ?? null,
      stepId: firstStep?.id ?? null,
    },
    status: recordStatusOf(job),
  });
  const isFolded = isCurrent && context.folded === "job";
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
    pick: { buildId: shown.check.buildId, folded: null, stageId: stage.id, stepId: null },
    status: recordStatusOf(stage),
  });
  const isOpen = isCurrent && context.folded !== "stage";
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

function createRun(context: TreeContext, check: PipelineCheck): HTMLElement[] {
  const isCurrent = check.buildId === context.shown.check.buildId;
  const item = createItem(context, {
    className: "fix-ado-pipeline-check",
    details: checkDetails(check),
    isCurrent,
    level: "run",
    name: check.name,
    pick: { buildId: check.buildId, folded: null, stageId: null, stepId: null },
    status: checkStatus(check),
  });
  const isOpen = isCurrent && context.folded !== "run";
  return isOpen ? [item, createStages(context)] : [item];
}

/** Gives a name that does not fit its full text as a tooltip, when the pointer gets there. */
function showCutOffNames(tree: HTMLElement): void {
  tree.addEventListener("mouseover", (event) => {
    const name = closestElement(event.target, `.${NAME_CLASS}`);
    if (name === null) {
      return;
    }
    if (name.scrollWidth > name.clientWidth) {
      name.setAttribute("title", name.textContent);
    } else {
      name.removeAttribute("title");
    }
  });
}

function createRunTree(context: TreeContext & { checks: PipelineCheck[] }): HTMLElement {
  const items = context.checks.flatMap((check) => createRun(context, check));
  const tree = group(context.document, "fix-ado-pipeline-tree", items);
  tree.setAttribute("role", "navigation");
  tree.setAttribute("aria-label", "Pipeline runs");
  showCutOffNames(tree);
  return tree;
}

export type { TreeContext };
export { createRunTree };
