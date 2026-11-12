import type { LogFrame, StepLog } from "./pipeline-log-frame.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showStepLog } from "./pipeline-log-frame.ts";
import { test } from "node:test";

const RUN_PATH = "/quillfield/Ledger/_build/results?buildId=812&view=logs";

function stepLog(buildId: number, stepName: string): StepLog {
  return { buildId, path: `${RUN_PATH}&j=job&t=${stepName}`, stepName };
}

interface FakeFrame {
  frame: LogFrame;
  /** Each src the frame was given. */
  sources: string[];
  /** What showStepLog scheduled, waiting to run. */
  scheduled: (() => void)[];
}

/** Runs what showStepLog scheduled, as if the wait were over. */
function finishWait(fake: FakeFrame): void {
  for (const callback of fake.scheduled.splice(0)) {
    callback();
  }
}

/** A frame on a run's log. With `switchesInPlace`, the page shows the step its URL names. */
function fakeFrame(switchesInPlace: boolean): FakeFrame {
  const { window } = new JSDOM(
    '<!doctype html><div class="logs-view"><div class="log-header"><div class="job-header"><div class="title-m">compile</div></div></div></div>',
    { url: `https://dev.azure.com${RUN_PATH}&j=job&t=compile` },
  );
  if (switchesInPlace) {
    window.addEventListener("popstate", () => {
      const title = window.document.querySelector(".title-m");
      if (title !== null) {
        title.textContent = new URL(window.location.href).searchParams.get("t");
      }
    });
  }
  Object.assign(globalThis, { PopStateEvent: window.PopStateEvent });
  const sources: string[] = [];
  const scheduled: (() => void)[] = [];
  const frame: LogFrame = {
    contentDocument: window.document,
    contentWindow: window,
    dataset: {},
    setAttribute: (_name: string, value: string) => {
      sources.push(value);
    },
  };
  return { frame, scheduled, sources };
}

function show(fake: FakeFrame, log: StepLog): void {
  showStepLog(fake.frame, log, (callback) => {
    fake.scheduled.push(callback);
  });
}

test("the first log loads the frame", () => {
  const fake = fakeFrame(true);
  show(fake, stepLog(812, "compile"));
  assert.deepEqual(fake.sources, [`${RUN_PATH}&j=job&t=compile`]);
});

test("the same log again leaves the frame alone", () => {
  const fake = fakeFrame(true);
  show(fake, stepLog(812, "compile"));
  show(fake, stepLog(812, "compile"));
  assert.equal(fake.sources.length, 1);
});

test("another step of the same run switches in place, without loading the frame", () => {
  const fake = fakeFrame(true);
  show(fake, stepLog(812, "compile"));
  show(fake, stepLog(812, "test"));
  finishWait(fake);
  assert.equal(fake.sources.length, 1);
  assert.match(fake.frame.contentWindow?.location.href ?? "", /t=test$/u);
});

test("when the page does not switch in place, the frame loads the step's log", () => {
  const fake = fakeFrame(false);
  show(fake, stepLog(812, "compile"));
  show(fake, stepLog(812, "test"));
  finishWait(fake);
  assert.deepEqual(fake.sources.at(-1), `${RUN_PATH}&j=job&t=test`);
});

test("a step of another run loads the frame at once", () => {
  const fake = fakeFrame(true);
  show(fake, stepLog(812, "compile"));
  show(fake, { ...stepLog(813, "lint"), path: "/quillfield/Ledger/_build/results?buildId=813" });
  assert.equal(fake.sources.at(-1), "/quillfield/Ledger/_build/results?buildId=813");
});
