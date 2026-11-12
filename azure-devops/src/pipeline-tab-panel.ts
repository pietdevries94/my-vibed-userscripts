// The content of the Pipeline tab: the pull request's checks on the left, and the
// selected run's steps on the right, as the run page in a frame.
import type { PipelineCheck } from "./pipeline-checks.ts";
import { createPipelineStatusIcon } from "./pipeline-status-icon.ts";

const PANEL_CLASS = "fix-ado-pipeline-panel";

type ChecksState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "loaded"; checks: PipelineCheck[] };

interface PanelContent {
  checks: ChecksState;
  /** The run in the frame, or null to show the newest. */
  selectedBuildId: number | null;
  pullRequestId: number;
  stepsPath: (buildId: number) => string;
  onPick: (buildId: number) => void;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };

function textElement(document: Document, className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function checkDetails(check: PipelineCheck): string {
  const required = check.isRequired ? "Required" : "Optional";
  return check.startedAt === null
    ? required
    : `${required} · ${new Date(check.startedAt).toLocaleString([], DATE_FORMAT)}`;
}

function createCheckButton(
  document: Document,
  check: PipelineCheck,
  content: PanelContent & { shownBuildId: number },
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "fix-ado-pipeline-check";
  button.type = "button";
  button.setAttribute("aria-current", String(check.buildId === content.shownBuildId));
  const text = textElement(document, "fix-ado-pipeline-check-text", "");
  text.append(
    textElement(document, "fix-ado-pipeline-check-name", check.name),
    textElement(document, "fix-ado-pipeline-check-details", checkDetails(check)),
  );
  button.append(
    ...(check.status === null
      ? []
      : [createPipelineStatusIcon(document, check.status, content.pullRequestId)]),
    text,
  );
  button.addEventListener("click", () => {
    content.onPick(check.buildId);
  });
  return button;
}

function message(panel: HTMLElement, text: string): void {
  panel.replaceChildren(textElement(panel.ownerDocument, "fix-ado-pipeline-message", text));
}

function createCheckList(
  document: Document,
  checks: PipelineCheck[],
  content: PanelContent & { shownBuildId: number },
): HTMLElement {
  const list = document.createElement("nav");
  list.className = "fix-ado-pipeline-checks";
  list.setAttribute("aria-label", "Pipeline checks");
  list.append(...checks.map((check) => createCheckButton(document, check, content)));
  return list;
}

/**
 * The frame of the panel. It is created once and never moved: a frame that leaves
 * the page loads its run again.
 */
function placeFrame(panel: HTMLElement, source: string): void {
  let frame = panel.querySelector<HTMLIFrameElement>(":scope > .fix-ado-pipeline-frame");
  if (frame === null) {
    panel.replaceChildren();
    frame = panel.ownerDocument.createElement("iframe");
    frame.className = "fix-ado-pipeline-frame";
    frame.title = "Pipeline run";
    panel.append(frame);
  }
  if (frame.getAttribute("src") !== source) {
    frame.setAttribute("src", source);
  }
}

function showChecks(panel: HTMLElement, checks: PipelineCheck[], content: PanelContent): void {
  const shown = checks.find((check) => check.buildId === content.selectedBuildId) ?? checks[0];
  if (shown === undefined) {
    message(panel, "This pull request has no pipeline runs.");
    return;
  }
  placeFrame(panel, content.stepsPath(shown.buildId));
  const list = createCheckList(panel.ownerDocument, checks, {
    ...content,
    shownBuildId: shown.buildId,
  });
  const oldList = panel.querySelector(":scope > .fix-ado-pipeline-checks");
  if (oldList === null) {
    panel.prepend(list);
  } else {
    oldList.replaceWith(list);
  }
}

/** What the panel shows. A render with the same key leaves the page alone. */
function renderKey(content: PanelContent): string {
  return JSON.stringify([content.checks, content.selectedBuildId]);
}

function renderPanel(panel: HTMLElement, content: PanelContent): void {
  const key = renderKey(content);
  if (panel.dataset.fixAdoRendered === key) {
    return;
  }
  panel.dataset.fixAdoRendered = key;
  if (content.checks.kind === "loading") {
    message(panel, "Loading pipeline checks…");
  } else if (content.checks.kind === "failed") {
    message(panel, "Could not load the pipeline checks.");
  } else {
    showChecks(panel, content.checks.checks, content);
  }
}

function createPanel(document: Document): HTMLElement {
  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.setAttribute("role", "tabpanel");
  return panel;
}

export type { ChecksState, PanelContent };
export { PANEL_CLASS, createPanel, renderPanel };
