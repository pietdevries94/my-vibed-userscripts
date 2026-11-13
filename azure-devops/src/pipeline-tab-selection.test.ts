import type { RunStage, RunStep } from "./pipeline-timeline.ts";
import type { PipelineRun } from "./pipeline-runs.ts";
import assert from "node:assert/strict";
import { shownRunOf } from "./pipeline-tab-selection.ts";
import { test } from "node:test";

function run(buildId: number): PipelineRun {
  return {
    buildId,
    buildNumber: String(buildId),
    isBusy: false,
    isRequired: true,
    name: `run ${buildId}`,
    startedAt: null,
    status: { status: "failed" },
  };
}

function step(id: string, result = "succeeded"): RunStep {
  return { id, jobId: `job-of-${id}`, name: id, result, state: "completed" };
}

function stage(id: string, steps: RunStep[]): RunStage {
  const job = { id: `${id}-job`, name: "job", result: null, state: "completed", steps };
  return { id, jobs: [job], name: id, result: null, state: "completed" };
}

const RUNS = [run(2), run(1)];
const STAGES = [
  stage("build", [step("checkout"), step("compile")]),
  stage("test", [step("unit", "failed"), step("e2e", "failed")]),
];
const STAGES_BY_BUILD_ID = new Map([[2, STAGES]]);
const NOTHING_PICKED = { buildId: null, folded: null, jobId: null, stageId: null, stepId: null };

const shownNames = (shown: ReturnType<typeof shownRunOf>): string[] => [
  String(shown?.run.buildId),
  shown?.stage?.id ?? "-",
  shown?.step?.id ?? "-",
];

test("without a pick, the newest run, its first failed step and that step's stage", () => {
  const shown = shownRunOf(RUNS, STAGES_BY_BUILD_ID, NOTHING_PICKED);
  assert.deepEqual(shownNames(shown), ["2", "test", "unit"]);
});

test("a picked stage shows its own first failed step, else its first step", () => {
  const picked = { buildId: 2, folded: null, jobId: null, stageId: "build", stepId: null };
  assert.deepEqual(shownNames(shownRunOf(RUNS, STAGES_BY_BUILD_ID, picked)), [
    "2",
    "build",
    "checkout",
  ]);
});

test("a picked step is shown with its stage", () => {
  const picked = { buildId: 2, folded: null, jobId: null, stageId: "test", stepId: "e2e" };
  assert.deepEqual(shownNames(shownRunOf(RUNS, STAGES_BY_BUILD_ID, picked)), ["2", "test", "e2e"]);
});

test("a run whose timeline is not loaded yet shows no stage or step", () => {
  const picked = { buildId: 1, folded: null, jobId: null, stageId: null, stepId: null };
  const shown = shownRunOf(RUNS, STAGES_BY_BUILD_ID, picked);
  assert.deepEqual(shownNames(shown), ["1", "-", "-"]);
  assert.equal(shown?.stages, null);
});

test("a picked step that is gone falls back to the stage's default", () => {
  const picked = { buildId: 2, folded: null, jobId: null, stageId: "build", stepId: "removed" };
  assert.deepEqual(shownNames(shownRunOf(RUNS, STAGES_BY_BUILD_ID, picked)), [
    "2",
    "build",
    "checkout",
  ]);
});

test("no runs, nothing shown", () => {
  assert.equal(shownRunOf([], STAGES_BY_BUILD_ID, NOTHING_PICKED), null);
});

test("a picked job without a picked step shows its running step, else its first failed, else its first", () => {
  const running = { ...step("e2e", "failed"), result: null, state: "inProgress" };
  const stages = [
    stage("build", [step("checkout")]),
    stage("test", [step("unit", "failed"), running]),
  ];
  const picked = { buildId: 2, folded: null, jobId: "test-job", stageId: "test", stepId: null };
  const shown = shownRunOf(RUNS, new Map([[2, stages]]), picked);
  assert.equal(shown?.step?.id, "e2e");
});
