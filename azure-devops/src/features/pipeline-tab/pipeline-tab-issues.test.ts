import {
  EVALUATIONS,
  LOG_PATH,
  TIMELINES,
  click,
  frameSource,
  pickItem,
  pipelineTab,
  setUp,
  settle,
  timelineRecord,
  treeNames,
} from "./pipeline-tab.test-page.ts";
import type { TimelineRecord } from "../../pipeline/pipeline-timeline.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

/** Run 502 with a warning on its build job, an error on compile, and a warning on unit. */
const TIMELINES_WITH_ISSUES: Record<number, TimelineRecord[]> = {
  ...TIMELINES,
  502: [
    timelineRecord("Stage", "build", { order: 1, result: "failed" }),
    timelineRecord("Stage", "test", { order: 2 }),
    timelineRecord("Job", "build-job", {
      issues: [{ message: "Agent is out of date", type: "warning" }],
      parentId: "build",
      warningCount: 1,
    }),
    timelineRecord("Job", "test-job", { parentId: "test" }),
    timelineRecord("Task", "checkout", { order: 1, parentId: "build-job" }),
    timelineRecord("Task", "compile", {
      errorCount: 1,
      issues: [{ message: "Missing semicolon", type: "error" }],
      order: 2,
      parentId: "build-job",
      result: "failed",
    }),
    timelineRecord("Task", "unit", {
      issues: [{ message: "Flaky test skipped", type: "warning" }],
      parentId: "test-job",
      warningCount: 1,
    }),
  ],
};

async function openTab(timelines = TIMELINES_WITH_ISSUES): Promise<Document> {
  const { document } = setUp(EVALUATIONS, timelines);
  click(pipelineTab(document));
  await settle();
  return document;
}

/** The issue list of the Pipeline tab, as "kind: place: message". */
const issueRows = (document: Document): string[] =>
  [...document.querySelectorAll<HTMLElement>(".fix-ado-pipeline-panel .fix-ado-issue")].map(
    (row) =>
      `${row.dataset.kind ?? ""}: ${row.querySelector(".fix-ado-issue-place")?.textContent ?? ""}: ${row.querySelector(".fix-ado-issue-message")?.textContent ?? ""}`,
  );

/** The issue counts on a tree item, as their labels. */
const countLabels = (document: Document, kind: string, name: string): string[] =>
  [...(pickItem(document, kind, name)?.querySelectorAll(".fix-ado-issue-count") ?? [])].map(
    (count) => count.getAttribute("aria-label") ?? "",
  );

test("the tab lists the shown run's errors, then its warnings, with where each one is", async () => {
  const document = await openTab();
  assert.deepEqual(issueRows(document), [
    "error: build-job / compile: Missing semicolon",
    "warning: build-job: Agent is out of date",
    "warning: test-job / unit: Flaky test skipped",
  ]);
  assert.equal(
    document.querySelector(".fix-ado-pipeline-panel .fix-ado-issue-box-title")?.textContent,
    "1 error, 2 warnings",
  );
});

test("a run without warnings or errors shows no issue list", async () => {
  const document = await openTab(TIMELINES);
  assert.equal(document.querySelector(".fix-ado-pipeline-panel .fix-ado-issue-box"), null);
});

test("picking an issue shows its step's log", async () => {
  const document = await openTab();
  const unit = [...document.querySelectorAll(".fix-ado-pipeline-panel .fix-ado-issue")].at(-1);
  click(unit ?? null);
  await settle();
  assert.deepEqual(treeNames(document, "stage"), ["build", "test*"]);
  assert.deepEqual(treeNames(document, "step"), ["unit*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=test-job&t=unit`);
});

test("picking an issue of a job shows that job", async () => {
  const document = await openTab();
  click(pickItem(document, "stage", "test"));
  await settle();
  const [, jobWarning] = document.querySelectorAll(".fix-ado-pipeline-panel .fix-ado-issue");
  click(jobWarning ?? null);
  await settle();
  assert.deepEqual(treeNames(document, "job"), ["build-job*"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*"]);
});

test("stages, jobs and steps show how many errors and warnings they hold", async () => {
  const document = await openTab();
  assert.deepEqual(countLabels(document, "stage", "build"), ["1 error", "1 warning"]);
  assert.deepEqual(countLabels(document, "stage", "test"), ["1 warning"]);
  assert.deepEqual(countLabels(document, "job", "build-job"), ["1 error", "1 warning"]);
  assert.deepEqual(countLabels(document, "step", "compile"), ["1 error"]);
  assert.deepEqual(countLabels(document, "step", "checkout"), []);
});
