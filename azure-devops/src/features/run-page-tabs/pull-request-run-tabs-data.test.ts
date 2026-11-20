import { BUILD_POLICY_TYPE_ID } from "../../pipeline/pipeline-status.ts";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import type { RunTab } from "./run-tab-store.ts";
import assert from "node:assert/strict";
import { pullRequestRunTabsOf } from "./pull-request-run-tabs-data.ts";
import { test } from "node:test";

/** A build check of the pipeline, with its run when it has one. */
function check(pipelineId: number, name: string, buildId: number | null): PolicyEvaluation {
  return {
    configuration: {
      isBlocking: true,
      settings: { buildDefinitionId: pipelineId, displayName: null },
      type: { id: BUILD_POLICY_TYPE_ID },
    },
    context: buildId === null ? null : { buildDefinitionName: name, buildId },
    status: "queued",
  };
}

function build(id: number, pipelineId: number): PullRequestBuild {
  return { buildNumber: `20310402.${id}`, definition: { id: pipelineId }, id, status: "completed" };
}

const coverage = (pipelineId: number, pipelineName: string): RunTab => ({
  label: "Code Coverage",
  pipelineId,
  pipelineName,
  view: "codecoverage-tab",
});
const DEPLOYMENTS: RunTab = {
  label: "Deployments",
  pipelineId: 7,
  pipelineName: "ledger-deploy",
  view: "quillfield.deploys.deploy-tab",
};

test("a turned-on tab shows for a check's pipeline, on the newest run of that pipeline", () => {
  const tabs = pullRequestRunTabsOf(
    [coverage(3, "ledger-ci")],
    [check(3, "ledger-ci", 501)],
    [build(502, 3), build(400, 9), build(501, 3)],
  );
  assert.deepEqual(
    tabs.map(({ buildId, name }) => [name, buildId]),
    [["Code Coverage", 502]],
  );
});

test("without a run in the list, the check's own run is the latest", () => {
  const [tab] = pullRequestRunTabsOf([coverage(3, "ledger-ci")], [check(3, "ledger-ci", 501)], []);
  assert.equal(tab?.buildId, 501);
});

test("a check's pipeline without a run gets the tab without a run; another pipeline gets none", () => {
  const tabs = pullRequestRunTabsOf(
    [DEPLOYMENTS, coverage(4, "ledger-lint")],
    [check(7, "ledger-deploy", null)],
    [],
  );
  assert.deepEqual(
    tabs.map(({ buildId, name }) => [name, buildId]),
    [["Deployments", null]],
  );
});

test("two tabs with the same label get their pipeline's name, in the order they were turned on", () => {
  const tabs = pullRequestRunTabsOf(
    [coverage(4, "ledger-lint"), DEPLOYMENTS, coverage(3, "ledger-ci")],
    [check(3, "ledger-ci", 501), check(4, "ledger-lint", 502), check(7, "ledger-deploy", 503)],
    [],
  );
  assert.deepEqual(
    tabs.map(({ name }) => name),
    ["Code Coverage (ledger-lint)", "Deployments", "Code Coverage (ledger-ci)"],
  );
});
