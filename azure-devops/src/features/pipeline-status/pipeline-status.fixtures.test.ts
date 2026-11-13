import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import assert from "node:assert/strict";
import { pipelineStatusOf } from "../../pipeline/pipeline-status.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedEvaluations {
  data: {
    evaluationsByPullRequestId: Record<number, { body: { value: PolicyEvaluation[] } | null }>;
  };
}

/** Pipeline status per stand-in pull request id, for a captured page. */
function capturedStatuses(page: string): Record<string, string | null> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  const { data } = JSON.parse(fixtures.read(`${page}.json`)) as CapturedEvaluations;
  return Object.fromEntries(
    Object.entries(data.evaluationsByPullRequestId).map(([id, response]) => [
      id,
      response.body === null ? "no response" : pipelineStatusOf(response.body.value),
    ]),
  );
}

test("statuses of the captured repository list", { skip: fixtures.skip }, () => {
  assert.deepEqual(capturedStatuses("pr-list"), { 1001: "failed", 1002: "queued" });
});

test("statuses of the captured inbox", { skip: fixtures.skip }, () => {
  assert.deepEqual(capturedStatuses("pr-inbox"), {
    1001: "queued",
    1002: "failed",
    1003: "queued",
  });
});
