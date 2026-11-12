import type { RunStage, RunStep } from "./pipeline-timeline.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import assert from "node:assert/strict";
import { shownRunOf } from "./pipeline-tab-selection.ts";
import { test } from "node:test";

function check(buildId: number): PipelineCheck {
  return { buildId, isRequired: true, name: `run ${buildId}`, startedAt: null, status: "failed" };
}

function step(id: string, result = "succeeded"): RunStep {
  return { id, jobId: `job-of-${id}`, name: id, result, state: "completed" };
}

function stage(id: string, steps: RunStep[]): RunStage {
  const job = { id: `${id}-job`, name: "job", result: null, state: "completed", steps };
  return { id, jobs: [job], name: id, result: null, state: "completed" };
}

const CHECKS = [check(2), check(1)];
const STAGES = [
  stage("build", [step("checkout"), step("compile")]),
  stage("test", [step("unit", "failed"), step("e2e", "failed")]),
];
const STAGES_BY_BUILD_ID = new Map([[2, STAGES]]);
const NOTHING_PICKED = { buildId: null, stageId: null, stepId: null };

const shownNames = (shown: ReturnType<typeof shownRunOf>): string[] => [
  String(shown?.check.buildId),
  shown?.stage?.id ?? "-",
  shown?.step?.id ?? "-",
];

test("without a pick, the newest run, its first failed step and that step's stage", () => {
  const shown = shownRunOf(CHECKS, STAGES_BY_BUILD_ID, NOTHING_PICKED);
  assert.deepEqual(shownNames(shown), ["2", "test", "unit"]);
});

test("a picked stage shows its own first failed step, else its first step", () => {
  const picked = { buildId: 2, stageId: "build", stepId: null };
  assert.deepEqual(shownNames(shownRunOf(CHECKS, STAGES_BY_BUILD_ID, picked)), [
    "2",
    "build",
    "checkout",
  ]);
});

test("a picked step is shown with its stage", () => {
  const picked = { buildId: 2, stageId: "test", stepId: "e2e" };
  assert.deepEqual(shownNames(shownRunOf(CHECKS, STAGES_BY_BUILD_ID, picked)), [
    "2",
    "test",
    "e2e",
  ]);
});

test("a run whose timeline is not loaded yet shows no stage or step", () => {
  const picked = { buildId: 1, stageId: null, stepId: null };
  const shown = shownRunOf(CHECKS, STAGES_BY_BUILD_ID, picked);
  assert.deepEqual(shownNames(shown), ["1", "-", "-"]);
  assert.equal(shown?.stages, null);
});

test("a picked step that is gone falls back to the stage's default", () => {
  const picked = { buildId: 2, stageId: "build", stepId: "removed" };
  assert.deepEqual(shownNames(shownRunOf(CHECKS, STAGES_BY_BUILD_ID, picked)), [
    "2",
    "build",
    "checkout",
  ]);
});

test("no checks, nothing shown", () => {
  assert.equal(shownRunOf([], STAGES_BY_BUILD_ID, NOTHING_PICKED), null);
});
