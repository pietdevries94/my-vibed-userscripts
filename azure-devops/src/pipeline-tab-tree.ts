// The left column of the Pipeline tab: the runs, the shown run's stages, and the
// shown stage's steps, grouped by job when the stage has more than one.
import type { PipelineTabPick, ShownRun } from "./pipeline-tab-selection.ts";
import type { RunJob, RunStage } from "./pipeline-timeline.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import type { PipelineStatus } from "./pipeline-status.ts";
import { createStatusIcon } from "./pipeline-status-icon.ts";
import { recordStatusOf } from "./pipeline-timeline.ts";

/** Azure DevOps's name for the one stage of a pipeline without stages. */
const DEFAULT_STAGE_NAME = "__default";
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };

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
  pick: PipelineTabPick;
}

type OnPick = (pick: PipelineTabPick) => void;

function textElement(document: Document, className: string, text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function createItemText(document: Document, item: TreeItem): HTMLElement {
  const text = textElement(document, "fix-ado-pipeline-item-text", "");
  text.append(textElement(document, "fix-ado-pipeline-item-name", item.name));
  if (item.details !== undefined) {
    text.append(textElement(document, "fix-ado-pipeline-item-details", item.details));
  }
  return text;
}

function createItem(document: Document, item: TreeItem, onPick: OnPick): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `fix-ado-pipeline-item ${item.className}`;
  button.setAttribute("aria-current", String(item.isCurrent));
  const text = createItemText(document, item);
  const icon =
    item.status === null ? [] : [createStatusIcon(document, item.status.status, item.status.label)];
  button.append(...icon, text);
  button.addEventListener("click", () => {
    onPick(item.pick);
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

function createJobSteps(
  document: Document,
  { job, shown }: { job: RunJob; shown: ShownRun },
  onPick: OnPick,
): HTMLButtonElement[] {
  const { check, stage, step } = shown;
  return job.steps.map((candidate) =>
    createItem(
      document,
      {
        className: "fix-ado-pipeline-step",
        isCurrent: candidate.id === step?.id,
        name: candidate.name,
        pick: { buildId: check.buildId, stageId: stage?.id ?? null, stepId: candidate.id },
        status: recordStatusOf(candidate),
      },
      onPick,
    ),
  );
}

function createSteps(document: Document, shown: ShownRun, onPick: OnPick): HTMLElement {
  const jobs = shown.stage?.jobs ?? [];
  const items: HTMLElement[] = [];
  for (const job of jobs) {
    if (jobs.length > 1) {
      items.push(textElement(document, "fix-ado-pipeline-job", job.name));
    }
    items.push(...createJobSteps(document, { job, shown }, onPick));
  }
  return group(document, "fix-ado-pipeline-steps", items);
}

function stageName(stage: RunStage): string {
  return stage.name === DEFAULT_STAGE_NAME ? "Jobs" : stage.name;
}

function createStages(document: Document, shown: ShownRun, onPick: OnPick): HTMLElement {
  if (shown.stages === null) {
    return textElement(document, "fix-ado-pipeline-note", "Loading stages…");
  }
  if (shown.stages.length === 0) {
    return textElement(document, "fix-ado-pipeline-note", "No stages yet.");
  }
  const items = shown.stages.flatMap((stage) => {
    const isCurrent = stage.id === shown.stage?.id;
    const pick = { buildId: shown.check.buildId, stageId: stage.id, stepId: null };
    const item = createItem(
      document,
      {
        className: "fix-ado-pipeline-stage",
        isCurrent,
        name: stageName(stage),
        pick,
        status: recordStatusOf(stage),
      },
      onPick,
    );
    return isCurrent ? [item, createSteps(document, shown, onPick)] : [item];
  });
  return group(document, "fix-ado-pipeline-stages", items);
}

function createRunTree(
  document: Document,
  { checks, shown }: { checks: PipelineCheck[]; shown: ShownRun },
  onPick: OnPick,
): HTMLElement {
  const items = checks.flatMap((check) => {
    const isCurrent = check.buildId === shown.check.buildId;
    const item = createItem(
      document,
      {
        className: "fix-ado-pipeline-check",
        details: checkDetails(check),
        isCurrent,
        name: check.name,
        pick: { buildId: check.buildId, stageId: null, stepId: null },
        status: checkStatus(check),
      },
      onPick,
    );
    return isCurrent ? [item, createStages(document, shown, onPick)] : [item];
  });
  const tree = group(document, "fix-ado-pipeline-tree", items);
  tree.setAttribute("role", "navigation");
  tree.setAttribute("aria-label", "Pipeline runs");
  return tree;
}

export { createRunTree };
