// The button at the top of the Pipeline tab's runs. While a run is busy it is a red
// "Cancel current run"; otherwise "Start new run", which re-queues a build check.
// With one run or check it acts at once; with several it opens a list to pick one.

/** What the button does now. */
type RunAction = "start" | "cancel";

/** Where the button stands: idle, the list open, waiting for Azure DevOps, or refused. */
type RunActionState = "idle" | "choosing" | "waiting" | "failed";

/** A run to cancel or a check to start, as the list shows it. */
interface RunActionChoice {
  /** The evaluation id of a check, or the build id of a run. */
  key: string;
  name: string;
  details: string;
}

interface RunActionContext {
  document: Document;
  action: RunAction;
  choices: RunActionChoice[];
  state: RunActionState;
  onToggleList: (isOpen: boolean) => void;
  onPick: (action: RunAction, key: string) => void;
}

const LABELS: Record<RunAction, { idle: string; waiting: string; failed: string }> = {
  cancel: {
    failed: "Could not cancel the run.",
    idle: "Cancel current run",
    waiting: "Cancelling…",
  },
  start: { failed: "Could not start the run.", idle: "Start new run", waiting: "Starting…" },
};

/** Azure DevOps's button looks: primary as Publish on a draft pull request, danger for red. */
const LOOKS: Record<RunAction, string> = { cancel: "danger", start: "primary" };

function textElement(document: Document, className: string, text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

/** A row of the list, built like a run in the tree: the name, then its details. */
function createChoice(context: RunActionContext, choice: RunActionChoice): HTMLButtonElement {
  const { document } = context;
  const row = document.createElement("button");
  row.type = "button";
  row.className = "fix-ado-pipeline-item fix-ado-pipeline-run-action-choice";
  const text = textElement(document, "fix-ado-pipeline-item-text", "");
  text.append(
    textElement(document, "fix-ado-pipeline-item-name", choice.name),
    textElement(document, "fix-ado-pipeline-item-details", choice.details),
  );
  row.append(text);
  row.addEventListener("click", () => {
    context.onPick(context.action, choice.key);
  });
  return row;
}

function createChoices(context: RunActionContext): HTMLElement {
  const list = context.document.createElement("div");
  list.className = "fix-ado-pipeline-run-action-choices";
  list.append(...context.choices.map((choice) => createChoice(context, choice)));
  return list;
}

/** One choice acts at once; several open or close the list to pick from. */
function onButtonClick({ action, choices, onPick, onToggleList, state }: RunActionContext): void {
  const [onlyChoice] = choices;
  if (choices.length === 1 && onlyChoice !== undefined) {
    onPick(action, onlyChoice.key);
  } else {
    onToggleList(state !== "choosing");
  }
}

function createButton(context: RunActionContext): HTMLButtonElement {
  const { action, choices, document, state } = context;
  const isWaiting = state === "waiting";
  // Azure DevOps's own button classes; its page styles them.
  const button = Object.assign(document.createElement("button"), {
    className: `bolt-button ${LOOKS[action]} bolt-focus-treatment ${isWaiting ? "disabled" : "enabled"} fix-ado-pipeline-run-action`,
    disabled: isWaiting,
    type: "button",
  });
  const label = LABELS[action][isWaiting ? "waiting" : "idle"];
  button.append(textElement(document, "bolt-button-text body-m", label));
  if (choices.length > 1) {
    button.setAttribute("aria-expanded", String(state === "choosing"));
  }
  button.addEventListener("click", () => {
    onButtonClick(context);
  });
  return button;
}

/** The button, with the list or a refusal note under it. Null with nothing to start or cancel. */
function createRunAction(context: RunActionContext): HTMLElement[] | null {
  const { action, choices, document, state } = context;
  if (choices.length === 0) {
    return null;
  }
  const button = createButton(context);
  if (state === "choosing") {
    return [button, createChoices(context)];
  }
  if (state === "failed") {
    return [button, textElement(document, "fix-ado-pipeline-note", LABELS[action].failed)];
  }
  return [button];
}

export type { RunAction, RunActionChoice, RunActionContext, RunActionState };
export { createRunAction };
