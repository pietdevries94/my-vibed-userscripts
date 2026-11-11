import type { PolicyEvaluation } from "./pipeline-status.ts";
import assert from "node:assert/strict";
import { pipelineStatusOf } from "./pipeline-status.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedEvaluations {
  evaluationsByPullRequestId: Record<number, { body: { value: PolicyEvaluation[] } }>;
}

function capturedEvaluations(pullRequestId: number): PolicyEvaluation[] {
  const text = fixtures.read("policy-evaluations-repository-pull-requests.json");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture tool writes this shape
  const fixture = JSON.parse(text) as CapturedEvaluations;
  return fixture.evaluationsByPullRequestId[pullRequestId].body.value;
}

test("captured pull requests", { skip: fixtures.skip }, () => {
  assert.equal(
    pipelineStatusOf(capturedEvaluations(1001)),
    "succeeded",
    "approved build next to a rejected merge-strategy policy",
  );
  assert.equal(
    pipelineStatusOf(capturedEvaluations(1012)),
    "notStarted",
    "draft: build policy queued, no build yet",
  );
  assert.equal(pipelineStatusOf(capturedEvaluations(1013)), "failed");
});
