import { issueCountsOf, runIssuesOf } from "./pipeline-issues.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { stagesOf } from "./pipeline-timeline.ts";
import { test } from "node:test";

function record(type: string, id: string, extra: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    id,
    name: id,
    order: 1,
    parentId: null,
    result: "succeeded",
    state: "completed",
    type,
    ...extra,
  };
}

const warning = (message: string): { message: string; type: string } => ({
  message,
  type: "warning",
});
const error = (message: string): { message: string; type: string } => ({
  message,
  type: "error",
});

// A build stage whose job warns and whose compile step fails, then a test stage that warns.
const RECORDS: TimelineRecord[] = [
  record("Stage", "build", { order: 1 }),
  record("Stage", "test", { issues: [warning("No tests found")], order: 2, warningCount: 1 }),
  record("Phase", "build-phase", { parentId: "build" }),
  record("Job", "build-job", {
    issues: [warning("Agent is out of date")],
    parentId: "build-phase",
    warningCount: 1,
  }),
  record("Task", "checkout", {
    issues: [warning("Shallow fetch")],
    order: 1,
    parentId: "build-job",
    warningCount: 1,
  }),
  record("Task", "compile", {
    errorCount: 2,
    issues: [error("Missing semicolon"), error("Exit code 1"), warning("Slow disk")],
    order: 2,
    parentId: "build-job",
    warningCount: 1,
  }),
  record("Job", "test-job", { parentId: "test" }),
  record("Task", "unit", { parentId: "test-job" }),
];

const placeAndMessage = (issue: { place: string[]; message: string }): string =>
  `${issue.place.join(" / ")}: ${issue.message}`;

test("an issue of a step keeps its line in the step's log", () => {
  const records = [
    record("Stage", "build"),
    record("Job", "build-job", { parentId: "build" }),
    record("Task", "compile", {
      errorCount: 1,
      issues: [{ ...error("Missing semicolon"), data: { logFileLineNumber: "214" } }],
      parentId: "build-job",
    }),
  ];
  const [issue] = runIssuesOf(stagesOf(records));
  assert.equal(issue?.lineNumber, 214);
});

test("a run's issues come errors first, then warnings, each in run order", () => {
  const issues = runIssuesOf(stagesOf(RECORDS));
  assert.deepEqual(
    issues.map((issue) => placeAndMessage(issue)),
    [
      "build-job / compile: Missing semicolon",
      "build-job / compile: Exit code 1",
      "build-job: Agent is out of date",
      "build-job / checkout: Shallow fetch",
      "build-job / compile: Slow disk",
      "test: No tests found",
    ],
  );
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    ["error", "error", "warning", "warning", "warning", "warning"],
  );
});

test("an issue knows the stage, job and step to open", () => {
  const spots = runIssuesOf(stagesOf(RECORDS)).map((issue) => [
    issue.stageId,
    issue.jobId,
    issue.stepId,
  ]);
  assert.deepEqual(spots, [
    ["build", "build-job", "compile"],
    ["build", "build-job", "compile"],
    ["build", "build-job", null],
    ["build", "build-job", "checkout"],
    ["build", "build-job", "compile"],
    ["test", null, null],
  ]);
});

test("a stage, job and step count their own issues and those of everything in them", () => {
  const counts = issueCountsOf(RECORDS);
  assert.deepEqual(counts.get("compile"), { errorCount: 2, warningCount: 1 });
  assert.deepEqual(counts.get("build-job"), { errorCount: 2, warningCount: 3 });
  assert.deepEqual(counts.get("build"), { errorCount: 2, warningCount: 3 });
  assert.deepEqual(counts.get("test"), { errorCount: 0, warningCount: 1 });
  assert.deepEqual(counts.get("unit"), { errorCount: 0, warningCount: 0 });
});

test("an issue a stage repeats from its job shows and counts once", () => {
  const records = [
    record("Stage", "deploy", { issues: [warning("Agent is out of date")], warningCount: 1 }),
    record("Job", "deploy-job", {
      issues: [warning("Agent is out of date")],
      parentId: "deploy",
      warningCount: 1,
    }),
  ];
  assert.deepEqual(
    runIssuesOf(stagesOf(records)).map((issue) => placeAndMessage(issue)),
    ["deploy-job: Agent is out of date"],
  );
  assert.deepEqual(issueCountsOf(records).get("deploy"), { errorCount: 0, warningCount: 1 });
});

test("a count above the issues Azure DevOps lists still counts in full", () => {
  const records = [
    record("Stage", "build"),
    record("Job", "build-job", { parentId: "build" }),
    record("Task", "lint", {
      issues: [warning("Unused variable")],
      parentId: "build-job",
      warningCount: 40,
    }),
  ];
  assert.deepEqual(issueCountsOf(records).get("build"), { errorCount: 0, warningCount: 40 });
});

test("a classic pipeline's issues sit in its one stage, without a stage name", () => {
  const records = [
    record("Job", "build-job", { errorCount: 1, issues: [error("Agent lost")] }),
    record("Task", "compile", { parentId: "build-job" }),
  ];
  const [issue] = runIssuesOf(stagesOf(records));
  assert.deepEqual(issue?.place, ["build-job"]);
  assert.equal(issue?.stageId, "");
});

test("a run without issues has none, and records without counts count zero", () => {
  const records = [record("Stage", "build")];
  assert.deepEqual(runIssuesOf(stagesOf(records)), []);
  assert.deepEqual(issueCountsOf(records).get("build"), {
    errorCount: 0,
    warningCount: 0,
  });
});
