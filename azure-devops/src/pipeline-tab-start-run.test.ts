import {
  EVALUATIONS,
  click,
  pipelineTab,
  requeue,
  setUp,
  settle,
} from "./pipeline-tab.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const START_BUTTON = ".fix-ado-pipeline-start";

/** Opens the Pipeline tab and lets its runs come in. */
async function openTab(...options: Parameters<typeof setUp>): Promise<ReturnType<typeof setUp>> {
  const setup = setUp(...options);
  click(pipelineTab(setup.document));
  await settle();
  return setup;
}

const menuNames = (document: Document): string[] =>
  [...document.querySelectorAll(".fix-ado-pipeline-start-choice")].map(
    (choice) => choice.querySelector(".fix-ado-pipeline-item-name")?.textContent ?? "",
  );

test("a Start new run button sits at the top of the runs", async () => {
  const { document } = await openTab();
  const button = document.querySelector(".fix-ado-pipeline-tree")?.firstElementChild ?? null;
  assert.equal(button?.matches(START_BUTTON), true);
  assert.equal(button?.textContent, "Start new run");
});

test("with one build check, the button re-queues it and the runs load again", async () => {
  const [check] = EVALUATIONS;
  const { document, requests, requeued } = await openTab([check]);
  const loadsBefore = requests.length;
  click(document.querySelector(START_BUTTON));
  await settle();
  assert.deepEqual(requeued, ["evaluation-501"]);
  assert.equal(requests.length, loadsBefore + 1);
  assert.equal(document.querySelector(START_BUTTON)?.textContent, "Start new run");
});

test("with several build checks, the button opens a list to pick the one to start", async () => {
  const { document, requeued } = await openTab();
  click(document.querySelector(START_BUTTON));
  await settle();
  assert.deepEqual(requeued, []);
  assert.deepEqual(menuNames(document), ["ledger-ci", "ledger-lint"]);
  const [, lint] = document.querySelectorAll(".fix-ado-pipeline-start-choice");
  click(lint ?? null);
  await settle();
  assert.deepEqual(requeued, ["evaluation-502"]);
  assert.deepEqual(menuNames(document), []);
});

test("a second click on the button closes the list", async () => {
  const { document } = await openTab();
  click(document.querySelector(START_BUTTON));
  click(document.querySelector(START_BUTTON));
  await settle();
  assert.deepEqual(menuNames(document), []);
});

test("while the run starts, the button waits; a refused start says so", async () => {
  const [check] = EVALUATIONS;
  const { document } = await openTab([check]);
  const refusal = Promise.withResolvers<undefined>();
  requeue.answer = async (): Promise<unknown> => refusal.promise;
  click(document.querySelector(START_BUTTON));
  await settle();
  const button = document.querySelector<HTMLButtonElement>(START_BUTTON);
  assert.equal(button?.textContent, "Starting…");
  assert.equal(button?.disabled, true);
  refusal.reject(new Error("refused"));
  await settle();
  assert.equal(document.querySelector(START_BUTTON)?.textContent, "Start new run");
  assert.match(
    document.querySelector(".fix-ado-pipeline-tree")?.textContent ?? "",
    /Could not start the run\./u,
  );
});

test("a pull request without build checks has no Start new run button", async () => {
  const { document } = await openTab([]);
  assert.equal(document.querySelector(START_BUTTON), null);
});

test("a build check without a run yet can still be started", async () => {
  const [check] = EVALUATIONS;
  const withoutRun = { ...check, context: { ...check.context, buildId: null }, status: "queued" };
  const { document, requeued } = await openTab([withoutRun]);
  assert.match(
    document.querySelector(".fix-ado-pipeline-panel")?.textContent ?? "",
    /no pipeline runs/u,
  );
  click(document.querySelector(START_BUTTON));
  await settle();
  assert.deepEqual(requeued, ["evaluation-501"]);
});
