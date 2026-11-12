import { parsePipelineRunLocation, pipelineLogPath } from "./pipeline-run-link.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const JOB_ID = "3dc8fd7e-4368-5a92-293e-d53cefc8c4b3";
const STEP_ID = "8c3e1b2a-77f0-5d1e-9a4b-6c2d0e9f1a35";

function locationOf(url: string): { pathname: string; search: string } {
  const { pathname, search } = new URL(url);
  return { pathname, search };
}

test("a run page without a view opens on its summary", () => {
  const location = locationOf("https://dev.azure.com/quillfield/Ledger/_build/results?buildId=812");
  assert.deepEqual(parsePipelineRunLocation(location), {
    buildId: 812,
    jobId: null,
    stepId: null,
    view: "summary",
  });
});

test("the logs view without a step is the steps overview", () => {
  const location = locationOf(
    "https://dev.azure.com/quillfield/Ledger/_build/results?buildId=812&view=logs",
  );
  assert.equal(parsePipelineRunLocation(location)?.view, "steps");
});

test("the logs view with a job and step shows that step's log", () => {
  const location = locationOf(
    `https://quillfield.visualstudio.com/Ledger/_build/results?buildId=812&view=logs&j=${JOB_ID}&t=${STEP_ID}`,
  );
  assert.deepEqual(parsePipelineRunLocation(location), {
    buildId: 812,
    jobId: JOB_ID,
    stepId: STEP_ID,
    view: "log",
  });
});

test("other pages are not a run page", () => {
  assert.equal(
    parsePipelineRunLocation(
      locationOf("https://dev.azure.com/quillfield/Ledger/_build?definitionId=4"),
    ),
    null,
  );
  assert.equal(
    parsePipelineRunLocation(locationOf("https://dev.azure.com/quillfield/Ledger/_build/results")),
    null,
  );
});

test("the log path of a step reads back as that step's log", () => {
  const path = pipelineLogPath("/quillfield", "Ledger Works", {
    buildId: 812,
    jobId: JOB_ID,
    stepId: STEP_ID,
  });
  assert.equal(
    path,
    `/quillfield/Ledger%20Works/_build/results?buildId=812&view=logs&j=${JOB_ID}&t=${STEP_ID}`,
  );
  const [pathname = "", search = ""] = path.split("?");
  assert.deepEqual(parsePipelineRunLocation({ pathname, search: `?${search}` }), {
    buildId: 812,
    jobId: JOB_ID,
    stepId: STEP_ID,
    view: "log",
  });
});
