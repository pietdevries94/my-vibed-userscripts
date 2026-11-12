import {
  EVALUATIONS,
  LOG_PATH,
  TIMELINES,
  click,
  frameSource,
  isOpen,
  pickItem,
  pipelineTab,
  setUp,
  settle,
  timelineRecord,
  treeNames,
} from "./pipeline-tab.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("opening the tab shows the newest run, the stage of its first failed step, and that step's log", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  assert.equal(isOpen(document), true);
  assert.equal(pipelineTab(document)?.getAttribute("aria-selected"), "true");
  assert.equal(
    document.querySelector("#__bolt-tab-overview")?.getAttribute("aria-selected"),
    "false",
  );
  assert.deepEqual(treeNames(document, "run"), ["ledger-lint*", "ledger-ci"]);
  assert.deepEqual(treeNames(document, "stage"), ["build*", "test"]);
  assert.deepEqual(treeNames(document, "job"), ["build-job*"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=build-job&t=compile`);
});

test("a stage shows all its jobs, each with its steps, and picking a job shows its first failed step", async () => {
  const timelines = {
    ...TIMELINES,
    502: [
      ...(TIMELINES[502] ?? []),
      timelineRecord("Job", "lint-job", { order: 2, parentId: "build" }),
      timelineRecord("Task", "eslint", { order: 1, parentId: "lint-job" }),
      timelineRecord("Task", "prettier", { order: 2, parentId: "lint-job", result: "failed" }),
    ],
  };
  const { document } = setUp(EVALUATIONS, timelines);
  click(pipelineTab(document));
  await settle();
  assert.deepEqual(treeNames(document, "job"), ["build-job*", "lint-job"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*", "eslint", "prettier"]);

  click(pickItem(document, "job", "lint-job"));
  assert.deepEqual(treeNames(document, "job"), ["build-job", "lint-job*"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile", "eslint", "prettier*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=lint-job&t=prettier`);
});

test("picking a run shows only its stages and steps", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(pickItem(document, "run", "ledger-ci"));
  await settle();
  assert.deepEqual(treeNames(document, "run"), ["ledger-lint", "ledger-ci*"]);
  assert.deepEqual(treeNames(document, "stage"), ["lint-stage*"]);
  assert.deepEqual(treeNames(document, "step"), ["lint*"]);
  assert.equal(frameSource(document), `${LOG_PATH}501&view=logs&j=lint-job&t=lint`);
});

test("picking a stage shows only its steps, and picking a step shows its log", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(pickItem(document, "stage", "test"));
  assert.deepEqual(treeNames(document, "stage"), ["build", "test*"]);
  assert.deepEqual(treeNames(document, "step"), ["unit*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=test-job&t=unit`);

  click(pickItem(document, "stage", "build"));
  click(pickItem(document, "step", "checkout"));
  assert.deepEqual(treeNames(document, "step"), ["checkout*", "compile"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=build-job&t=checkout`);
});

test("clicking the current run, stage or job folds it, and clicking again opens it", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  const source = frameSource(document);

  click(pickItem(document, "job", "build-job"));
  assert.deepEqual(treeNames(document, "job"), ["build-job*"]);
  assert.deepEqual(treeNames(document, "step"), []);

  click(pickItem(document, "stage", "build"));
  assert.deepEqual(treeNames(document, "stage"), ["build*", "test"]);
  assert.deepEqual(treeNames(document, "job"), []);

  click(pickItem(document, "run", "ledger-lint"));
  assert.deepEqual(treeNames(document, "run"), ["ledger-lint*", "ledger-ci"]);
  assert.deepEqual(treeNames(document, "stage"), []);
  assert.equal(frameSource(document), source, "the log stays");

  click(pickItem(document, "run", "ledger-lint"));
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*"]);
});

test("a row whose name does not fit gets the full name as its tooltip", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  const [cutOff, fits] = [...document.querySelectorAll<HTMLElement>(".fix-ado-pipeline-step")];
  const cutOffName = cutOff?.querySelector(".fix-ado-pipeline-item-name");
  assert.ok(
    cutOff !== undefined && fits !== undefined && cutOffName !== null && cutOffName !== undefined,
  );
  Object.defineProperty(cutOffName, "scrollWidth", { value: 300 });
  Object.defineProperty(cutOffName, "clientWidth", { value: 200 });
  const view = document.defaultView;
  assert.ok(view);
  // The pointer is on the row's icon, not on its name.
  for (const row of [cutOff, fits]) {
    row.querySelector("svg")?.dispatchEvent(new view.MouseEvent("mouseover", { bubbles: true }));
  }
  assert.equal(cutOff.title, "checkout");
  assert.equal(fits.hasAttribute("title"), false);
});
