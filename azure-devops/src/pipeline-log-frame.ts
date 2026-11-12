// Points the Pipeline tab's frame at a step's log. Within one run, the script clicks
// the step in the run page's own step tree, which style.css hides: the page then
// switches the log as fast as Azure DevOps does. When the step is not in that tree,
// or the page does not follow, the frame loads the step's log.

/** The frame, as far as this module uses it. */
interface LogFrame {
  contentDocument: Document | null;
  dataset: DOMStringMap;
  setAttribute: (name: string, value: string) => void;
}

interface StepLog {
  buildId: number;
  /** The log page's path. */
  path: string;
  /** What the log header shows once the page is on this step. */
  stepName: string;
  /** The job the step is in, to tell apart steps with the same name. */
  jobName: string;
}

type Schedule = (callback: () => void, delayMs: number) => void;

/** How often, and how many times, the script looks whether the page switched. */
const SWITCH_CHECK_MS = 100;
const SWITCH_CHECKS = 15;
const LOG_TITLE_SELECTOR = ".logs-view .log-header .job-header .title-m";
const TREE_ROW_SELECTOR = ".run-logs-tree .bolt-tree-row";
const ROW_NAME_SELECTOR = ".job-name-area [role=button]";

function load(frame: LogFrame, log: StepLog): void {
  frame.setAttribute("src", log.path);
}

/** The step the log header shows, or null while the page has none. */
function shownStepName(frame: LogFrame): string | null {
  const title = frame.contentDocument?.querySelector(LOG_TITLE_SELECTOR);
  return title?.textContent.trim() ?? null;
}

function showsStep(frame: LogFrame, stepName: string): boolean {
  return shownStepName(frame) === stepName;
}

/** The step's name in the run page's tree: the first one after its job's row, else the first one. */
function stepInTree(document: Document, log: StepLog): HTMLElement | null {
  const names = [...document.querySelectorAll(TREE_ROW_SELECTOR)]
    .map((row) => row.querySelector<HTMLElement>(ROW_NAME_SELECTOR))
    .filter((name) => name !== null);
  const jobIndex = names.findIndex((name) => name.textContent.trim() === log.jobName);
  const isStep = (name: HTMLElement): boolean => name.textContent.trim() === log.stepName;
  const underJob = names.slice(jobIndex + 1).find((name) => isStep(name));
  return underJob ?? names.find((name) => isStep(name)) ?? null;
}

/** Looks a few times whether the page shows the step, and loads it when it does not. */
function waitForSwitch(frame: LogFrame, log: StepLog, schedule: Schedule): void {
  let checksLeft = SWITCH_CHECKS;
  const check = (): void => {
    if (frame.dataset.fixAdoLogPath !== log.path || showsStep(frame, log.stepName)) {
      return;
    }
    checksLeft -= 1;
    if (checksLeft > 0) {
      schedule(check, SWITCH_CHECK_MS);
    } else {
      load(frame, log);
    }
  };
  schedule(check, SWITCH_CHECK_MS);
}

/** The step in the frame's tree, when the frame shows the same run. */
function stepInFrame(frame: LogFrame, log: StepLog): HTMLElement | null {
  const isSameRun = frame.dataset.fixAdoBuildId === String(log.buildId);
  const document = frame.contentDocument;
  return isSameRun && document !== null ? stepInTree(document, log) : null;
}

function showStepLog(frame: LogFrame, log: StepLog, schedule: Schedule = setTimeout): void {
  if (frame.dataset.fixAdoLogPath === log.path) {
    return;
  }
  const step = stepInFrame(frame, log);
  frame.dataset.fixAdoLogPath = log.path;
  frame.dataset.fixAdoBuildId = String(log.buildId);
  if (step === null) {
    load(frame, log);
    return;
  }
  step.click();
  waitForSwitch(frame, log, schedule);
}

/**
 * Calls `onStep` each time the log header shows another step, as when the run page
 * follows a running run by itself. Watches every page the frame loads; once per frame.
 */
function watchShownStep(frame: HTMLIFrameElement, onStep: (stepName: string) => void): void {
  if (frame.dataset.fixAdoWatched !== undefined) {
    return;
  }
  frame.dataset.fixAdoWatched = "";
  let lastStepName: string | null = null;
  const report = (): void => {
    const stepName = shownStepName(frame);
    if (stepName !== null && stepName !== lastStepName) {
      lastStepName = stepName;
      onStep(stepName);
    }
  };
  const watchPage = (): void => {
    const view = frame.contentDocument?.defaultView;
    if (frame.contentDocument !== null && view !== null && view !== undefined) {
      const options = { characterData: true, childList: true, subtree: true };
      new view.MutationObserver(report).observe(frame.contentDocument, options);
    }
  };
  frame.addEventListener("load", watchPage);
  watchPage();
}

export type { LogFrame, StepLog };
export { showStepLog, watchShownStep };
