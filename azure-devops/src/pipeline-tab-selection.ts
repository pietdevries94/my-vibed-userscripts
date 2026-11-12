// Which run, stage and step the Pipeline tab shows, from what the owner picked.
import type { RunStage, RunStep } from "./pipeline-timeline.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import { defaultStepOf } from "./pipeline-timeline.ts";

/** A level of the run tree that can be folded. */
type TreeLevel = "run" | "stage" | "job";

/** What the owner picked. Null at a level means "the default". */
interface PipelineTabPick {
  buildId: number | null;
  stageId: string | null;
  stepId: string | null;
  /** The level the owner folded, to see the list it is in. Null when nothing is folded. */
  folded: TreeLevel | null;
}

interface ShownRun {
  check: PipelineCheck;
  /** Null while the run's timeline loads. */
  stages: RunStage[] | null;
  stage: RunStage | null;
  step: RunStep | null;
}

function stageWithStep(stages: RunStage[], stepId: string): RunStage | undefined {
  return stages.find((stage) =>
    stage.jobs.some((job) => job.steps.some((step) => step.id === stepId)),
  );
}

function shownStepOf(stages: RunStage[], pick: PipelineTabPick): RunStep | null {
  const pickedStage = stages.find((stage) => stage.id === pick.stageId);
  const steps = (pickedStage === undefined ? stages : [pickedStage]).flatMap((stage) =>
    stage.jobs.flatMap((job) => job.steps),
  );
  const pickedStep = steps.find((step) => step.id === pick.stepId);
  return pickedStep ?? defaultStepOf(pickedStage === undefined ? stages : [pickedStage]);
}

function shownRunOf(
  checks: PipelineCheck[],
  stagesByBuildId: Map<number, RunStage[]>,
  pick: PipelineTabPick,
): ShownRun | null {
  const check = checks.find((candidate) => candidate.buildId === pick.buildId) ?? checks[0];
  if (check === undefined) {
    return null;
  }
  const stages = stagesByBuildId.get(check.buildId) ?? null;
  if (stages === null) {
    return { check, stage: null, stages, step: null };
  }
  const step = shownStepOf(stages, pick);
  const stage =
    (step === null ? undefined : stageWithStep(stages, step.id)) ??
    stages.find((candidate) => candidate.id === pick.stageId) ??
    stages[0] ??
    null;
  return { check, stage, stages, step };
}

export type { PipelineTabPick, ShownRun, TreeLevel };
export { shownRunOf };
