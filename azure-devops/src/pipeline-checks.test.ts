import { pipelineChecksOf, startableChecksOf } from "./pipeline-checks.ts";
import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

interface BuildOptions {
  buildId?: number | null;
  name?: string;
  displayName?: string | null;
  startedAt?: string;
  isBlocking?: boolean;
  evaluationId?: string;
}

function buildEvaluation(status: string, options: BuildOptions = {}): PolicyEvaluation {
  return {
    configuration: {
      isBlocking: options.isBlocking ?? true,
      settings: { displayName: options.displayName ?? null },
      type: { id: BUILD_POLICY_TYPE_ID },
    },
    context: {
      buildDefinitionName: options.name ?? "ledger-ci",
      buildId: options.buildId === undefined ? 501 : options.buildId,
      buildStartedUtc: options.startedAt ?? "2031-04-02T09:00:00Z",
    },
    evaluationId: options.evaluationId ?? "evaluation-1",
    status,
  };
}

const reviewerEvaluation: PolicyEvaluation = {
  configuration: { isBlocking: true, type: { id: "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd" } },
  status: "approved",
};

test("a pull request without build checks has no pipeline checks", () => {
  assert.deepEqual(pipelineChecksOf([reviewerEvaluation]), []);
});

test("a build check shows its run, name, status and whether it is required", () => {
  assert.deepEqual(pipelineChecksOf([reviewerEvaluation, buildEvaluation("approved")]), [
    {
      buildId: 501,
      isRequired: true,
      name: "ledger-ci",
      startedAt: "2031-04-02T09:00:00Z",
      status: "succeeded",
    },
  ]);
});

test("the policy's own display name goes before the pipeline name", () => {
  const [check] = pipelineChecksOf([buildEvaluation("running", { displayName: "Unit tests" })]);
  assert.equal(check?.name, "Unit tests");
});

test("a check without a run is left out, as there is nothing to show", () => {
  assert.deepEqual(pipelineChecksOf([buildEvaluation("queued", { buildId: null })]), []);
});

test("a re-queued check whose run is not made yet, with build id 0, is left out", () => {
  assert.deepEqual(pipelineChecksOf([buildEvaluation("queued", { buildId: 0 })]), []);
});

test("the newest run comes first", () => {
  const checks = pipelineChecksOf([
    buildEvaluation("approved", { buildId: 1, startedAt: "2031-04-02T09:00:00Z" }),
    buildEvaluation("rejected", {
      buildId: 2,
      isBlocking: false,
      startedAt: "2031-04-02T11:30:00Z",
    }),
    buildEvaluation("running", { buildId: 3, startedAt: "2031-04-02T10:15:00Z" }),
  ]);
  assert.deepEqual(
    checks.map(({ buildId, isRequired, status }) => ({ buildId, isRequired, status })),
    [
      { buildId: 2, isRequired: false, status: "failed" },
      { buildId: 3, isRequired: true, status: "running" },
      { buildId: 1, isRequired: true, status: "succeeded" },
    ],
  );
});

test("every build check can start a new run, also one without a run yet", () => {
  assert.deepEqual(
    startableChecksOf([
      reviewerEvaluation,
      buildEvaluation("approved", { evaluationId: "evaluation-1" }),
      buildEvaluation("queued", {
        buildId: null,
        displayName: "Unit tests",
        evaluationId: "evaluation-2",
        isBlocking: false,
      }),
    ]),
    [
      { evaluationId: "evaluation-1", isRequired: true, name: "ledger-ci" },
      { evaluationId: "evaluation-2", isRequired: false, name: "Unit tests" },
    ],
  );
});
