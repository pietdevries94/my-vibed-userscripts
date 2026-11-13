import { BUILD_POLICY_TYPE_ID, pipelineStatusOf } from "./pipeline-status.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const buildEvaluation = (
  status: string,
  overrides: Partial<{ isBlocking: boolean; context: PolicyEvaluation["context"] }> = {},
): PolicyEvaluation => ({
  configuration: { isBlocking: overrides.isBlocking ?? true, type: { id: BUILD_POLICY_TYPE_ID } },
  context: "context" in overrides ? overrides.context : { buildId: 1, isExpired: false },
  status,
});
const reviewerEvaluation = (status: string): PolicyEvaluation => ({
  configuration: { isBlocking: true, type: { id: "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd" } },
  status,
});

test("a pull request without build validation has no status", () => {
  assert.equal(pipelineStatusOf([]), null);
  assert.equal(pipelineStatusOf([reviewerEvaluation("rejected")]), null);
});

test("running and queued builds", () => {
  assert.equal(pipelineStatusOf([buildEvaluation("running")]), "running");
  assert.equal(pipelineStatusOf([buildEvaluation("queued")]), "queued");
  assert.equal(pipelineStatusOf([buildEvaluation("queued", { context: undefined })]), "notStarted");
});

test("an expired build result", () => {
  assert.equal(
    pipelineStatusOf([buildEvaluation("queued", { context: { buildId: 1, isExpired: true } })]),
    "expired",
  );
});

test("a broken policy counts as failed", () => {
  assert.equal(pipelineStatusOf([buildEvaluation("broken")]), "failed");
});

test("the worst build decides when there are several", () => {
  assert.equal(
    pipelineStatusOf([buildEvaluation("approved"), buildEvaluation("rejected")]),
    "failed",
  );
  assert.equal(
    pipelineStatusOf([buildEvaluation("approved"), buildEvaluation("running")]),
    "running",
  );
});

test("required builds decide over optional ones", () => {
  assert.equal(
    pipelineStatusOf([
      buildEvaluation("approved"),
      buildEvaluation("rejected", { isBlocking: false }),
    ]),
    "succeeded",
  );
  assert.equal(pipelineStatusOf([buildEvaluation("rejected", { isBlocking: false })]), "failed");
});
