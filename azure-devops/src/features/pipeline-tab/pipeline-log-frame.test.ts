import type { LogFrame, StepLog } from "./pipeline-log-frame.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showStepLog } from "./pipeline-log-frame.ts";
import { test } from "node:test";

const RUN_PATH = "/quillfield/Ledger/_build/results?buildId=812&view=logs";

function stepLog(stepName: string, jobName = "build"): StepLog {
  return { buildId: 812, jobName, path: `${RUN_PATH}&t=${jobName}-${stepName}`, stepName };
}

/** The run page's hidden tree: two jobs that both have a checkout step. */
const RUN_PAGE = `<!doctype html>
  <div class="run-logs-tree"><table><tbody>
    <tr class="bolt-tree-row" aria-level="1"><td><div class="job-name-area"><span role="button">build</span></div></td></tr>
    <tr class="bolt-tree-row" aria-level="2"><td><div class="job-name-area"><span role="button">checkout</span></div></td></tr>
    <tr class="bolt-tree-row" aria-level="2"><td><div class="job-name-area"><span role="button">compile</span></div></td></tr>
    <tr class="bolt-tree-row" aria-level="1"><td><div class="job-name-area"><span role="button">lint</span></div></td></tr>
    <tr class="bolt-tree-row" aria-level="2"><td><div class="job-name-area"><span role="button">checkout</span></div></td></tr>
  </tbody></table></div>
  <div class="logs-view"><div class="log-header"><div class="job-header"><div class="title-m">compile</div></div></div></div>`;

interface FakeFrame {
  frame: LogFrame;
  /** Each src the frame was given. */
  sources: string[];
  /** What showStepLog scheduled, waiting to run. */
  scheduled: (() => void)[];
  /** The tree rows the script clicked, as job/step. */
  clicked: string[];
}

/** Runs what showStepLog scheduled until it stops scheduling, as if time passed. */
function finishWait(fake: FakeFrame): void {
  for (
    let callback = fake.scheduled.shift();
    callback !== undefined;
    callback = fake.scheduled.shift()
  ) {
    callback();
  }
}

/**
 * A frame on a run's log. With `switchesInPlace`, a click on a tree row shows that
 * step, as Azure DevOps does.
 */
function fakeFrame(switchesInPlace: boolean): FakeFrame {
  const { document } = new JSDOM(RUN_PAGE).window;
  const clicked: string[] = [];
  let job = "";
  for (const name of document.querySelectorAll(".job-name-area [role=button]")) {
    const isJob = name.closest("tr")?.getAttribute("aria-level") === "1";
    job = isJob ? (name.textContent ?? "") : job;
    const rowJob = job;
    name.addEventListener("click", () => {
      clicked.push(`${rowJob}/${name.textContent}`);
      const title = document.querySelector(".title-m");
      if (switchesInPlace && title !== null) {
        title.textContent = name.textContent;
      }
    });
  }
  const sources: string[] = [];
  const frame: LogFrame = {
    contentDocument: document,
    dataset: {},
    setAttribute: (_name: string, value: string) => {
      sources.push(value);
    },
  };
  return { clicked, frame, scheduled: [], sources };
}

function show(fake: FakeFrame, log: StepLog): void {
  showStepLog(fake.frame, log, (callback) => {
    fake.scheduled.push(callback);
  });
}

/** A fake frame that already shows the compile step. */
function frameOnCompile(switchesInPlace: boolean): FakeFrame {
  const fake = fakeFrame(switchesInPlace);
  show(fake, stepLog("compile"));
  return fake;
}

test("the first log loads the frame", () => {
  const fake = frameOnCompile(true);
  assert.deepEqual(fake.sources, [`${RUN_PATH}&t=build-compile`]);
});

test("the same log again leaves the frame alone", () => {
  const fake = frameOnCompile(true);
  show(fake, stepLog("compile"));
  assert.equal(fake.sources.length, 1);
});

test("another step of the run is clicked in the page's tree, without loading the frame", () => {
  const fake = frameOnCompile(true);
  show(fake, stepLog("checkout"));
  finishWait(fake);
  assert.deepEqual(fake.clicked, ["build/checkout"]);
  assert.equal(fake.sources.length, 1);
});

test("a step name used by two jobs is clicked under the right job", () => {
  const fake = frameOnCompile(true);
  show(fake, stepLog("checkout", "lint"));
  assert.deepEqual(fake.clicked, ["lint/checkout"]);
});

test("when the page does not switch, the frame loads the step's log", () => {
  const fake = frameOnCompile(false);
  show(fake, stepLog("checkout"));
  finishWait(fake);
  assert.equal(fake.sources.at(-1), `${RUN_PATH}&t=build-checkout`);
});

test("a step that is not in the page's tree loads the frame at once", () => {
  const fake = frameOnCompile(true);
  show(fake, stepLog("deploy"));
  assert.deepEqual(fake.clicked, []);
  assert.equal(fake.sources.at(-1), `${RUN_PATH}&t=build-deploy`);
});

test("a step of another run loads the frame at once", () => {
  const fake = frameOnCompile(true);
  show(fake, { ...stepLog("checkout"), buildId: 813, path: "/other-run" });
  assert.deepEqual(fake.clicked, []);
  assert.equal(fake.sources.at(-1), "/other-run");
});
