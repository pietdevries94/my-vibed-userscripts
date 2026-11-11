import assert from "node:assert/strict";
import { test } from "node:test";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { pipelineStatusOf, type PolicyEvaluation } from "./pipeline-status.ts";

const fixtures = scriptFixtures(import.meta.dirname);

function capturedEvaluations(pullRequestId: number): PolicyEvaluation[] {
  const fixture = JSON.parse(fixtures.read("policy-evaluations-repository-pull-requests.json"));
  return fixture.evaluationsByPullRequestId[pullRequestId].body.value;
}

test("captured pull requests", { skip: fixtures.skip }, () => {
  assert.equal(pipelineStatusOf(capturedEvaluations(1001)), "succeeded", "approved build next to a rejected merge-strategy policy");
  assert.equal(pipelineStatusOf(capturedEvaluations(1012)), "notStarted", "draft: build policy queued, no build yet");
  assert.equal(pipelineStatusOf(capturedEvaluations(1013)), "failed");
});
