import {
  EVALUATIONS,
  PULL_REQUEST,
  answerRuns,
  click,
  clock,
  pipelineTab,
  setUp,
  settle,
  treeNames,
  writeAnswer,
} from "./pipeline-tab.test-page.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import assert from "node:assert/strict";
import { logEntries } from "../../../../shared/runtime/script-log.ts";
import { test } from "node:test";

const ACTION_BUTTON = ".fix-ado-pipeline-run-action";

/** Opens the Pipeline tab and lets its runs come in. */
async function openTab(...options: Parameters<typeof setUp>): Promise<ReturnType<typeof setUp>> {
  const setup = setUp(...options);
  click(pipelineTab(setup.document));
  await settle();
  return setup;
}

const menuNames = (document: Document): string[] =>
  [...document.querySelectorAll(".fix-ado-pipeline-run-action-choice")].map(
    (choice) => choice.querySelector(".fix-ado-pipeline-item-name")?.textContent ?? "",
  );

test("a Start new run button sits at the top of the runs", async () => {
  const { document } = await openTab();
  const button = document.querySelector(".fix-ado-pipeline-tree")?.firstElementChild ?? null;
  assert.equal(button?.matches(ACTION_BUTTON), true);
  assert.equal(button?.textContent, "Start new run");
});

test("the button is built like Azure DevOps's primary buttons, such as Publish", async () => {
  const { document } = await openTab();
  const button = document.querySelector(ACTION_BUTTON);
  assert.deepEqual(
    ["bolt-button", "primary", "enabled"].map((name) => button?.classList.contains(name)),
    [true, true, true],
  );
  assert.equal(button?.querySelector(".bolt-button-text")?.textContent, "Start new run");
});

test("with one build check, the button re-queues it and the runs load again", async () => {
  const [check] = EVALUATIONS;
  const { document, requests, requeued } = await openTab([check]);
  const loadsBefore = requests.length;
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  assert.deepEqual(requeued, ["evaluation-501"]);
  assert.equal(requests.length, loadsBefore + 1);
  assert.equal(document.querySelector(ACTION_BUTTON)?.textContent, "Start new run");
});

test("with several build checks, the button opens a list to pick the one to start", async () => {
  const { document, requeued } = await openTab();
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  assert.deepEqual(requeued, []);
  assert.deepEqual(menuNames(document), ["ledger-ci", "ledger-lint"]);
  const [, lint] = document.querySelectorAll(".fix-ado-pipeline-run-action-choice");
  click(lint ?? null);
  await settle();
  assert.deepEqual(requeued, ["evaluation-502"]);
  assert.deepEqual(menuNames(document), []);
});

test("a second click on the button closes the list", async () => {
  const { document } = await openTab();
  click(document.querySelector(ACTION_BUTTON));
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  assert.deepEqual(menuNames(document), []);
});

test("while the run starts, the button waits; a refused start says so", async () => {
  const [check] = EVALUATIONS;
  const { document } = await openTab([check]);
  const refusal = Promise.withResolvers<undefined>();
  writeAnswer.answer = async (): Promise<unknown> => refusal.promise;
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  const button = document.querySelector<HTMLButtonElement>(ACTION_BUTTON);
  assert.equal(button?.textContent, "Starting…");
  assert.equal(button?.disabled, true);
  assert.equal(button?.classList.contains("disabled"), true);
  refusal.reject(new Error("refused"));
  await settle();
  assert.equal(document.querySelector(ACTION_BUTTON)?.textContent, "Start new run");
  assert.match(
    document.querySelector(".fix-ado-pipeline-tree")?.textContent ?? "",
    /Could not start the run\./u,
  );
});

test("a pull request without build checks has no Start new run button", async () => {
  const { document } = await openTab([]);
  assert.equal(document.querySelector(ACTION_BUTTON), null);
});

test("a build check without a run yet can still be started", async () => {
  const [check] = EVALUATIONS;
  const withoutRun = { ...check, context: { ...check.context, buildId: null }, status: "queued" };
  const { document, requeued } = await openTab([withoutRun]);
  assert.match(
    document.querySelector(".fix-ado-pipeline-panel")?.textContent ?? "",
    /no pipeline runs/u,
  );
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  assert.deepEqual(requeued, ["evaluation-501"]);
});

test("after a start, the runs load every 5 seconds for a minute, without a run for build id 0", async () => {
  const [check] = EVALUATIONS;
  const evaluations = [check];
  const { document, requests, tab } = await openTab(evaluations);
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  evaluations[0] = { ...check, context: { ...check.context, buildId: 0 }, status: "queued" };
  const loadsAt = async (nowMs: number): Promise<number> => {
    clock.nowMs = nowMs;
    const before = requests.length;
    tab.sync(PULL_REQUEST);
    await settle();
    return requests.length - before;
  };
  assert.equal(await loadsAt(5000), 1);
  assert.deepEqual(treeNames(document, "run"), []);
  assert.equal(await loadsAt(60_000), 1);
  assert.equal(await loadsAt(65_000), 0);
});

/** A run of the run list, newest first as Azure DevOps gives them. */
const busyBuild = (id: number, status: string): PullRequestBuild => ({
  buildNumber: `20310402.${id}`,
  definition: { name: `ledger-${id}` },
  id,
  status,
});

test("while a run is busy, the button is a red Cancel current run that cancels it", async () => {
  const { cancelled, document } = await openTab(
    [],
    undefined,
    answerRuns([busyBuild(7, "inProgress")]),
  );
  const button = document.querySelector(ACTION_BUTTON);
  assert.equal(button?.textContent, "Cancel current run");
  assert.equal(button?.classList.contains("danger"), true);
  click(button);
  await settle();
  assert.deepEqual(cancelled, [7]);
  const sent = logEntries().findLast((entry) => entry.message.includes("cancel sent"));
  assert.deepEqual(sent?.data, { buildId: 7 });
});

test("with several busy runs, the button opens a list to pick the run to cancel", async () => {
  const { cancelled, document } = await openTab(
    [],
    undefined,
    answerRuns([busyBuild(8, "notStarted"), busyBuild(7, "inProgress")]),
  );
  click(document.querySelector(ACTION_BUTTON));
  await settle();
  assert.deepEqual(menuNames(document), ["ledger-8", "ledger-7"]);
  const [, older] = document.querySelectorAll(".fix-ado-pipeline-run-action-choice");
  click(older ?? null);
  await settle();
  assert.deepEqual(cancelled, [7]);
});

test("a cancelling run is not busy, so the button starts a new run again", async () => {
  const { document } = await openTab(
    EVALUATIONS,
    undefined,
    answerRuns([busyBuild(7, "cancelling")]),
  );
  assert.equal(document.querySelector(ACTION_BUTTON)?.textContent, "Start new run");
});

test("a cancelling run says so in its row, with its own icon", async () => {
  const { document } = await openTab([], undefined, answerRuns([busyBuild(7, "cancelling")]));
  const row = document.querySelector(".fix-ado-pipeline-run");
  assert.match(
    row?.querySelector(".fix-ado-pipeline-item-details")?.textContent ?? "",
    /^Cancelling · /u,
  );
  assert.equal(row?.querySelector("svg")?.dataset.status, "cancelling");
});
