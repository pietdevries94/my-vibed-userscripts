import type { PipelineCheck, PullRequestBuild } from "./pipeline-checks.ts";
import assert from "node:assert/strict";
import { pipelineRunsOf } from "./pipeline-runs.ts";
import { test } from "node:test";

function build(id: number, extra: Partial<PullRequestBuild> = {}): PullRequestBuild {
  return {
    buildNumber: `20310402.${id}`,
    definition: { name: "ledger-ci" },
    id,
    queueTime: `2031-04-02T0${id}:00:00Z`,
    result: "succeeded",
    startTime: `2031-04-02T0${id}:01:00Z`,
    status: "completed",
    ...extra,
  };
}

const CHECK: PipelineCheck = {
  buildId: 3,
  isRequired: true,
  name: "Ledger CI",
  startedAt: "2031-04-02T03:01:00Z",
  status: "succeeded",
};

test("every run of the pull request is listed in the run list's order, newest first", () => {
  const runs = pipelineRunsOf([CHECK], [build(3), build(2), build(1)]);
  assert.deepEqual(
    runs.map((run) => run.buildId),
    [3, 2, 1],
  );
});

test("a run that is a current check keeps the check's name and label", () => {
  const [newest, older] = pipelineRunsOf([CHECK], [build(3), build(2)]);
  assert.deepEqual(newest, {
    buildId: 3,
    buildNumber: "20310402.3",
    isRequired: true,
    name: "Ledger CI",
    startedAt: "2031-04-02T03:01:00Z",
    status: { status: "succeeded" },
  });
  assert.equal(older?.isRequired, null);
  assert.equal(older?.name, "ledger-ci");
});

/** The icon status and label of one older run. */
function statusOf(extra: Partial<PullRequestBuild>): string {
  const [run] = pipelineRunsOf([], [build(1, extra)]);
  return `${run?.status?.status}: ${run?.status?.label}`;
}

test("an older run's icon comes from its own status and result", () => {
  assert.equal(statusOf({ result: "failed" }), "failed: Failed");
  assert.equal(statusOf({ result: "partiallySucceeded" }), "expired: Partly succeeded");
  assert.equal(statusOf({ result: "canceled" }), "notStarted: Canceled");
  assert.equal(statusOf({ result: undefined, status: "inProgress" }), "running: Running");
  assert.equal(statusOf({ result: undefined, status: "notStarted" }), "queued: Queued");
});

test("a check whose run is not in the run list is still listed, first", () => {
  assert.deepEqual(
    pipelineRunsOf([CHECK], [build(1)]).map((run) => run.buildId),
    [3, 1],
  );
});
