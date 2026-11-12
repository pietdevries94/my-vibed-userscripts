// Points the Pipeline tab's frame at a step's log. Within one run, the run page
// switches steps through its own history, so the frame does not load again. When the
// page does not follow, the frame loads the step's log after all.

/** The frame, as far as this module uses it. */
interface LogFrame {
  contentWindow: Pick<Window, "history" | "location" | "dispatchEvent"> | null;
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
}

type Schedule = (callback: () => void, delayMs: number) => void;

/** How long the run page gets to switch steps in place. */
const SWITCH_WAIT_MS = 2000;
const LOG_TITLE_SELECTOR = ".logs-view .log-header .job-header .title-m";

function load(frame: LogFrame, log: StepLog): void {
  frame.setAttribute("src", log.path);
}

function showsStep(frame: LogFrame, stepName: string): boolean {
  const title = frame.contentDocument?.querySelector(LOG_TITLE_SELECTOR);
  return title?.textContent.trim() === stepName;
}

/** Asks the run page to show another step, as its back and forward buttons do. */
function switchInPlace(frame: LogFrame, log: StepLog): boolean {
  const frameWindow = frame.contentWindow;
  if (frameWindow === null) {
    return false;
  }
  try {
    const state: unknown = frameWindow.history.state;
    frameWindow.history.pushState(state, "", log.path);
    frameWindow.dispatchEvent(new PopStateEvent("popstate", { state }));
    return true;
  } catch {
    // The frame is on another origin, or not loaded yet.
    return false;
  }
}

function showStepLog(frame: LogFrame, log: StepLog, schedule: Schedule = setTimeout): void {
  if (frame.dataset.fixAdoLogPath === log.path) {
    return;
  }
  const isSameRun = frame.dataset.fixAdoBuildId === String(log.buildId);
  frame.dataset.fixAdoLogPath = log.path;
  frame.dataset.fixAdoBuildId = String(log.buildId);
  if (!isSameRun || !switchInPlace(frame, log)) {
    load(frame, log);
    return;
  }
  schedule(() => {
    if (frame.dataset.fixAdoLogPath === log.path && !showsStep(frame, log.stepName)) {
      load(frame, log);
    }
  }, SWITCH_WAIT_MS);
}

export type { LogFrame, StepLog };
export { showStepLog };
