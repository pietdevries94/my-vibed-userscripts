import type { PipelineStatus } from "./pipeline-status.ts";

const PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const LABELS: Record<PipelineStatus, string> = {
  expired: "Pipeline result expired",
  failed: "Pipeline failed",
  notStarted: "Pipeline not started",
  queued: "Pipeline queued",
  running: "Pipeline running",
  succeeded: "Pipeline succeeded",
};

type Shape = [tag: "circle" | "path", attributes: Record<string, string>];

const DISC: Shape = ["circle", { cx: "8", cy: "8", fill: "currentColor", r: "8" }];
const RING: Shape = [
  "circle",
  { cx: "8", cy: "8", fill: "none", r: "7", stroke: "currentColor", "stroke-width": "2" },
];
const SPINNER: Shape = [
  "circle",
  {
    cx: "8",
    cy: "8",
    fill: "none",
    r: "6.5",
    stroke: "currentColor",
    "stroke-dasharray": "28 13",
    "stroke-linecap": "round",
    "stroke-width": "2.5",
  },
];

function line(pathData: string, stroke: string): Shape {
  const attributes = {
    fill: "none",
    stroke,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "1.75",
  };
  return ["path", { d: pathData, ...attributes }];
}

const SHAPES: Record<PipelineStatus, Shape[]> = {
  expired: [DISC, line("M8 4v5M8 11.9v.1", "#fff")],
  failed: [DISC, line("M5.5 5.5l5 5M10.5 5.5l-5 5", "#fff")],
  notStarted: [RING],
  queued: [RING, line("M8 4.5V8l2.5 1.5", "currentColor")],
  running: [SPINNER],
  succeeded: [DISC, line("M4.5 8.3l2.3 2.3 4.7-5", "#fff")],
};

function setAttributes(element: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function createShape(document: Document, [tag, attributes]: Shape): SVGElement {
  const shape = document.createElementNS(SVG_NAMESPACE, tag);
  setAttributes(shape, attributes);
  return shape;
}

function createPipelineStatusIcon(
  document: Document,
  status: PipelineStatus,
  pullRequestId: number,
): SVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  setAttributes(icon, {
    "aria-label": LABELS[status],
    class: PIPELINE_STATUS_ICON_CLASS,
    height: "16",
    role: "img",
    viewBox: "0 0 16 16",
    width: "16",
  });
  icon.dataset.status = status;
  icon.dataset.pullRequestId = String(pullRequestId);

  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = LABELS[status];
  icon.append(title, ...SHAPES[status].map((shape) => createShape(document, shape)));
  return icon;
}

export { PIPELINE_STATUS_ICON_CLASS, createPipelineStatusIcon };
