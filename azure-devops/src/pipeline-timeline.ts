/** One record of a run's timeline: a stage, phase, job, step (`Task`) or checkpoint. */
interface TimelineRecord {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  order?: number;
  /** `pending`, `inProgress` or `completed`. */
  state: string;
  /** `succeeded`, `failed`, `skipped`, … or null while the record runs. */
  result: string | null;
}

interface RunStep {
  id: string;
  jobId: string;
  name: string;
  state: string;
  result: string | null;
}

interface RunJob {
  id: string;
  name: string;
  state: string;
  result: string | null;
  steps: RunStep[];
}

interface RunStage {
  id: string;
  name: string;
  state: string;
  result: string | null;
  jobs: RunJob[];
}

/** The stage a classic pipeline's jobs go in: it has no stage records. */
const NO_STAGE_ID = "";

function inRunOrder<Item extends { order?: number }>(records: Item[]): Item[] {
  return records.toSorted((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

/** The stage a record sits in, found by walking up its parents. */
function stageIdOf(record: TimelineRecord, byId: Map<string, TimelineRecord>): string {
  let parent = record.parentId === null ? undefined : byId.get(record.parentId);
  while (parent !== undefined && parent.type !== "Stage") {
    parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
  }
  return parent?.id ?? NO_STAGE_ID;
}

function jobOf(job: TimelineRecord, records: TimelineRecord[]): RunJob {
  const steps = inRunOrder(
    records.filter((record) => record.type === "Task" && record.parentId === job.id),
  ).map(({ id, name, result, state }) => ({ id, jobId: job.id, name, result, state }));
  return { id: job.id, name: job.name, result: job.result, state: job.state, steps };
}

/** The run's stages with their jobs and steps, each in run order. */
function stagesOf(records: TimelineRecord[]): RunStage[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const jobs = inRunOrder(records.filter((record) => record.type === "Job"));
  const stages = inRunOrder(records.filter((record) => record.type === "Stage"));
  const stageRecords: Pick<TimelineRecord, "id" | "name" | "result" | "state">[] =
    stages.length > 0 || jobs.length === 0
      ? stages
      : [{ id: NO_STAGE_ID, name: "Jobs", result: null, state: "" }];
  return stageRecords.map(({ id, name, result, state }) => ({
    id,
    jobs: jobs.filter((job) => stageIdOf(job, byId) === id).map((job) => jobOf(job, records)),
    name,
    result,
    state,
  }));
}

/** The step to show first: the first failed one, else the first one. Null without steps. */
function defaultStepOf(stages: RunStage[]): RunStep | null {
  const steps = stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
  return steps.find((step) => step.result === "failed") ?? steps[0] ?? null;
}

export type { RunJob, RunStage, RunStep, TimelineRecord };
export { defaultStepOf, stagesOf };
