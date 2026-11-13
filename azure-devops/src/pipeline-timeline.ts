import type { IssueCounts, RunIssue, TimelineIssue } from "./pipeline-issues.ts";
import {
  NO_ISSUES,
  issueCountsOf,
  ownIssuesOf,
  runIssuesAt,
  sumIssueCounts,
} from "./pipeline-issues.ts";
import type { PipelineStatus } from "./pipeline-status.ts";

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
  /** The record's own warnings and errors; Azure DevOps lists only the first few. */
  issues?: TimelineIssue[] | null;
  warningCount?: number | null;
  errorCount?: number | null;
}

interface RunStep extends IssueCounts {
  id: string;
  jobId: string;
  name: string;
  state: string;
  result: string | null;
}

interface RunJob extends IssueCounts {
  id: string;
  name: string;
  state: string;
  result: string | null;
  steps: RunStep[];
}

interface RunStage extends IssueCounts {
  id: string;
  name: string;
  state: string;
  result: string | null;
  jobs: RunJob[];
  /** The stage's warnings and errors, and those of its jobs and steps, in run order. */
  issues: RunIssue[];
}

/** How a stage, job or step shows: one of the pipeline status icons, with its own label. */
interface RecordStatus {
  status: PipelineStatus;
  label: string;
}

const RESULT_STATUSES: Record<string, RecordStatus> = {
  abandoned: { label: "Canceled", status: "notStarted" },
  canceled: { label: "Canceled", status: "notStarted" },
  failed: { label: "Failed", status: "failed" },
  skipped: { label: "Skipped", status: "notStarted" },
  succeeded: { label: "Succeeded", status: "succeeded" },
  succeededWithIssues: { label: "Succeeded with warnings", status: "expired" },
};

function recordStatusOf({ result, state }: Pick<TimelineRecord, "result" | "state">): RecordStatus {
  if (state === "inProgress") {
    return { label: "Running", status: "running" };
  }
  const finished = result === null ? undefined : RESULT_STATUSES[result];
  return finished ?? { label: "Not started", status: "notStarted" };
}

/** The stage a classic pipeline's jobs go in: it has no stage records. */
const NO_STAGE_ID = "";
/** Azure DevOps's name for the one stage of a pipeline without stages. */
const DEFAULT_STAGE_NAME = "__default";

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

/** What the parts of a run read from the whole timeline. */
interface TimelineIndex {
  records: TimelineRecord[];
  byId: Map<string, TimelineRecord>;
  counts: Map<string, IssueCounts>;
  ownIssues: Map<string, TimelineIssue[]>;
}

function countsOf(index: TimelineIndex, id: string): IssueCounts {
  return index.counts.get(id) ?? NO_ISSUES;
}

function jobOf(job: TimelineRecord, index: TimelineIndex): RunJob {
  const steps = inRunOrder(
    index.records.filter((record) => record.type === "Task" && record.parentId === job.id),
  ).map(({ id, name, result, state }) => {
    const { errorCount, warningCount } = countsOf(index, id);
    return { errorCount, id, jobId: job.id, name, result, state, warningCount };
  });
  return {
    id: job.id,
    name: job.name,
    result: job.result,
    state: job.state,
    steps,
    ...countsOf(index, job.id),
  };
}

/** A stage's own issues and those of its phases and checkpoints, then its jobs' and steps', in run order. */
function stageIssuesOf(
  stage: { id: string; name: string },
  jobs: RunJob[],
  index: TimelineIndex,
): RunIssue[] {
  const ownOf = (id: string): TimelineIssue[] => index.ownIssues.get(id) ?? [];
  const stageSpot = {
    job: null,
    stage: {
      id: stage.id,
      name: stage.id === NO_STAGE_ID || stage.name === DEFAULT_STAGE_NAME ? null : stage.name,
    },
    step: null,
  };
  const stageLevelRecords = index.records.filter(
    (record) =>
      record.type !== "Job" &&
      record.type !== "Task" &&
      (record.id === stage.id || stageIdOf(record, index.byId) === stage.id),
  );
  return [
    ...stageLevelRecords.flatMap((record) => runIssuesAt(stageSpot, ownOf(record.id))),
    ...jobs.flatMap((job) => {
      const jobSpot = { ...stageSpot, job };
      return [
        ...runIssuesAt(jobSpot, ownOf(job.id)),
        ...job.steps.flatMap((step) => runIssuesAt({ ...jobSpot, step }, ownOf(step.id))),
      ];
    }),
  ];
}

/** The run's stages with their jobs and steps, each in run order, with their warnings and errors. */
function stagesOf(records: TimelineRecord[]): RunStage[] {
  const index: TimelineIndex = {
    byId: new Map(records.map((record) => [record.id, record])),
    counts: issueCountsOf(records),
    ownIssues: ownIssuesOf(records),
    records,
  };
  const jobs = inRunOrder(records.filter((record) => record.type === "Job"));
  const stages = inRunOrder(records.filter((record) => record.type === "Stage"));
  const stageRecords: Pick<TimelineRecord, "id" | "name" | "result" | "state">[] =
    stages.length > 0 || jobs.length === 0
      ? stages
      : [{ id: NO_STAGE_ID, name: "Jobs", result: null, state: "" }];
  return stageRecords.map((stage) => {
    const stageJobs = jobs
      .filter((job) => stageIdOf(job, index.byId) === stage.id)
      .map((job) => jobOf(job, index));
    const { errorCount, warningCount } =
      stage.id === NO_STAGE_ID ? sumIssueCounts(stageJobs) : countsOf(index, stage.id);
    return {
      errorCount,
      id: stage.id,
      issues: stageIssuesOf(stage, stageJobs, index),
      jobs: stageJobs,
      name: stage.name,
      result: stage.result,
      state: stage.state,
      warningCount,
    };
  });
}

/**
 * The step to show first: the running one, else the first failed one, else the first
 * one. Null without steps.
 */
function defaultStepOf(stages: RunStage[]): RunStep | null {
  const steps = stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
  return (
    steps.find((step) => step.state === "inProgress") ??
    steps.find((step) => step.result === "failed") ??
    steps[0] ??
    null
  );
}

export type { RecordStatus, RunJob, RunStage, RunStep, TimelineRecord };
export { DEFAULT_STAGE_NAME, defaultStepOf, recordStatusOf, stagesOf };
