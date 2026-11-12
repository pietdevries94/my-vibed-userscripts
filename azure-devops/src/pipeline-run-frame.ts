// The pipeline run page inside the pull request's Pipeline tab. style.css hides
// the site chrome and, by the view set here, either the steps or the log.
import { closestElement } from "./closest-element.ts";
import { parsePipelineRunLocation } from "./pipeline-run-link.ts";

type RunFrameView = "steps" | "log";

const BACK_BUTTON_CLASS = "fix-ado-run-back";
const STEP_ROW_SELECTOR = ".run-logs-tree .bolt-tree-row";
const EXPAND_BUTTON_SELECTOR = ".bolt-tree-expand-button";

interface PipelineRunFrame {
  /** Applies the view and adds the Back button when Azure DevOps re-rendered the log header. */
  sync: () => void;
}

function isStepRowClick(target: EventTarget | null): boolean {
  return (
    closestElement(target, STEP_ROW_SELECTOR) !== null &&
    closestElement(target, EXPAND_BUTTON_SELECTOR) === null
  );
}

function createBackButton(document: Document, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BACK_BUTTON_CLASS;
  button.textContent = "← Steps";
  button.addEventListener("click", onClick);
  return button;
}

/** The frame's run page, or null when the frame shows another page. */
function createPipelineRunFrame(document: Document): PipelineRunFrame | null {
  const run = parsePipelineRunLocation(document.location);
  if (run === null) {
    return null;
  }
  let view: RunFrameView = run.view === "log" ? "log" : "steps";

  function sync(): void {
    document.documentElement.dataset.fixAdoRunView = view;
    const logHeader = document.querySelector(".logs-view .log-header");
    if (logHeader !== null && logHeader.querySelector(`.${BACK_BUTTON_CLASS}`) === null) {
      logHeader.prepend(
        createBackButton(document, () => {
          show("steps");
        }),
      );
    }
  }

  function show(nextView: RunFrameView): void {
    view = nextView;
    sync();
  }

  document.addEventListener(
    "click",
    (event) => {
      const { target } = event;
      if (isStepRowClick(target)) {
        show("log");
      }
    },
    { capture: true },
  );

  return { sync };
}

export type { PipelineRunFrame };
export { createPipelineRunFrame };
