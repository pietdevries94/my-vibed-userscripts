// Which run, stage and step the Pipeline tab shows, from what the owner picked.
import type { RunStage, RunStep } from "../../pipeline/pipeline-timeline.ts";
import type { PipelineRun } from "../../pipeline/pipeline-runs.ts";
import { defaultStepOf } from "../../pipeline/pipeline-timeline.ts";

/** A level of the run tree that can be folded. */
type TreeLevel = "run" | "stage" | "job";

/** What the owner picked. Null at a level means "the default". */
interface PipelineTabPick {
  buildId: number | null;
  stageId: string | null;
  jobId: string | null;
  /** Null to follow the default step: the running one, else the first failed one. */
  stepId: string | null;
  /** The level the owner folded, to see the list it is in. Null when nothing is folded. */
  folded: TreeLevel | null;
}

interface ShownRun {
  run: PipelineRun;
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

/** The stages the pick narrows to: its job, else its stage, else the whole run. */
function pickedScope(stages: RunStage[], pick: PipelineTabPick): RunStage[] {
  const pickedStage = stages.find((stage) => stage.id === pick.stageId);
  const pickedJob = (pickedStage?.jobs ?? []).find((job) => job.id === pick.jobId);
  if (pickedStage !== undefined && pickedJob !== undefined) {
    return [{ ...pickedStage, jobs: [pickedJob] }];
  }
  return pickedStage === undefined ? stages : [pickedStage];
}

function shownStepOf(stages: RunStage[], pick: PipelineTabPick): RunStep | null {
  const scope = pickedScope(stages, pick);
  const steps = scope.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
  const pickedStep = steps.find((step) => step.id === pick.stepId);
  return pickedStep ?? defaultStepOf(scope);
}

function shownRunOf(
  runs: PipelineRun[],
  stagesByBuildId: Map<number, RunStage[]>,
  pick: PipelineTabPick,
): ShownRun | null {
  const run = runs.find((candidate) => candidate.buildId === pick.buildId) ?? runs[0];
  if (run === undefined) {
    return null;
  }
  const stages = stagesByBuildId.get(run.buildId) ?? null;
  if (stages === null) {
    return { run, stage: null, stages, step: null };
  }
  const step = shownStepOf(stages, pick);
  const stage =
    (step === null ? undefined : stageWithStep(stages, step.id)) ??
    stages.find((candidate) => candidate.id === pick.stageId) ??
    stages[0] ??
    null;
  return { run, stage, stages, step };
}

export type { PipelineTabPick, ShownRun, TreeLevel };
export { shownRunOf };
