// The "Start new run" button at the top of the Pipeline tab's runs. With one build
// check it re-queues that check; with several it opens a list to pick one.
import type { StartableCheck } from "./pipeline-checks.ts";

/** Where a start stands: idle, the list open, waiting for Azure DevOps, or refused. */
type StartRunState = "idle" | "choosing" | "starting" | "failed";

interface StartRunContext {
  document: Document;
  checks: StartableCheck[];
  state: StartRunState;
  onToggleList: (isOpen: boolean) => void;
  onStart: (evaluationId: string) => void;
}

const BUTTON_LABEL = "Start new run";

function textElement(document: Document, className: string, text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

/** A row of the list, built like a run in the tree: the name, then Required or Optional. */
function createChoice(context: StartRunContext, check: StartableCheck): HTMLButtonElement {
  const { document } = context;
  const choice = document.createElement("button");
  choice.type = "button";
  choice.className = "fix-ado-pipeline-item fix-ado-pipeline-start-choice";
  const text = textElement(document, "fix-ado-pipeline-item-text", "");
  text.append(
    textElement(document, "fix-ado-pipeline-item-name", check.name),
    textElement(
      document,
      "fix-ado-pipeline-item-details",
      check.isRequired ? "Required" : "Optional",
    ),
  );
  choice.append(text);
  choice.addEventListener("click", () => {
    context.onStart(check.evaluationId);
  });
  return choice;
}

function createChoices(context: StartRunContext): HTMLElement {
  const list = context.document.createElement("div");
  list.className = "fix-ado-pipeline-start-choices";
  list.append(...context.checks.map((check) => createChoice(context, check)));
  return list;
}

/** One check starts at once; several open or close the list to pick from. */
function onButtonClick({ checks, onStart, onToggleList, state }: StartRunContext): void {
  const [onlyCheck] = checks;
  if (checks.length === 1 && onlyCheck !== undefined) {
    onStart(onlyCheck.evaluationId);
  } else {
    onToggleList(state !== "choosing");
  }
}

function createButton(context: StartRunContext): HTMLButtonElement {
  const { checks, document, state } = context;
  const isStarting = state === "starting";
  // Azure DevOps's primary button, as Publish on a draft pull request; its page styles it.
  const button = Object.assign(document.createElement("button"), {
    className: `bolt-button primary bolt-focus-treatment ${isStarting ? "disabled" : "enabled"} fix-ado-pipeline-start`,
    disabled: isStarting,
    type: "button",
  });
  const label = isStarting ? "Starting…" : BUTTON_LABEL;
  button.append(textElement(document, "bolt-button-text body-m", label));
  if (checks.length > 1) {
    button.setAttribute("aria-expanded", String(state === "choosing"));
  }
  button.addEventListener("click", () => {
    onButtonClick(context);
  });
  return button;
}

/** The button, with the list of checks or a refusal note under it. Null without build checks. */
function createStartRun(context: StartRunContext): HTMLElement[] | null {
  const { checks, document, state } = context;
  if (checks.length === 0) {
    return null;
  }
  const button = createButton(context);
  if (state === "choosing") {
    return [button, createChoices(context)];
  }
  if (state === "failed") {
    return [button, textElement(document, "fix-ado-pipeline-note", "Could not start the run.")];
  }
  return [button];
}

export type { StartRunContext, StartRunState };
export { createStartRun };
