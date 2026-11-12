import { defaultStepOf, stagesOf } from "./pipeline-timeline.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

/** A finished, green record named after its id. `extra` overrides any field. */
function record(type: string, id: string, extra: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    id,
    name: id,
    order: 1,
    parentId: null,
    result: "succeeded",
    state: "completed",
    type,
    ...extra,
  };
}

// Two stages, given out of order as Azure DevOps does. Test has two jobs.
const RECORDS: TimelineRecord[] = [
  record("Task", "lint-2", { order: 2, parentId: "test-unit", result: "failed" }),
  record("Stage", "build", { order: 1 }),
  record("Stage", "test", { order: 2, result: "failed" }),
  record("Phase", "build-phase", { parentId: "build" }),
  record("Job", "build-job", { parentId: "build-phase" }),
  record("Task", "compile", { order: 2, parentId: "build-job" }),
  record("Task", "checkout", { order: 1, parentId: "build-job" }),
  record("Phase", "test-phase", { parentId: "test" }),
  record("Job", "test-unit", { order: 1, parentId: "test-phase", result: "failed" }),
  record("Job", "test-e2e", { order: 2, parentId: "test-phase" }),
  record("Task", "lint-1", { order: 1, parentId: "test-unit" }),
  record("Task", "e2e", { parentId: "test-e2e" }),
  record("Checkpoint", "approval", { parentId: "test" }),
];

const names = (items: { name: string }[]): string[] => items.map((item) => item.name);

test("stages, their jobs and their steps come in run order", () => {
  const stages = stagesOf(RECORDS);
  assert.deepEqual(names(stages), ["build", "test"]);
  assert.deepEqual(names(stages[0]?.jobs ?? []), ["build-job"]);
  assert.deepEqual(names(stages[0]?.jobs[0]?.steps ?? []), ["checkout", "compile"]);
  assert.deepEqual(names(stages[1]?.jobs ?? []), ["test-unit", "test-e2e"]);
  assert.deepEqual(names(stages[1]?.jobs[0]?.steps ?? []), ["lint-1", "lint-2"]);
});

test("a step keeps its state, result and job", () => {
  const [step] = stagesOf(RECORDS)[1]?.jobs[0]?.steps.slice(1) ?? [];
  assert.deepEqual(step, {
    id: "lint-2",
    jobId: "test-unit",
    name: "lint-2",
    result: "failed",
    state: "completed",
  });
});

test("the first failed step is picked, in run order", () => {
  assert.equal(defaultStepOf(stagesOf(RECORDS))?.id, "lint-2");
});

test("without a failure the first step is picked", () => {
  const stages = stagesOf(RECORDS).slice(0, 1);
  assert.equal(defaultStepOf(stages)?.id, "checkout");
});

test("a run without steps yet has nothing to pick", () => {
  const stagesWithoutSteps = stagesOf([record("Stage", "build")]);
  assert.equal(defaultStepOf(stagesWithoutSteps), null);
  assert.deepEqual(stagesOf([]), []);
});
