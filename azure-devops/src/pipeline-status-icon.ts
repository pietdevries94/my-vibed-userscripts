import type { PipelineStatus } from "./pipeline-status.ts";

export const PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const LABELS: Record<PipelineStatus, string> = {
  succeeded: "Pipeline succeeded",
  failed: "Pipeline failed",
  running: "Pipeline running",
  queued: "Pipeline queued",
  notStarted: "Pipeline not started",
  expired: "Pipeline result expired",
};

type Shape = [tag: "circle" | "path", attributes: Record<string, string>];

const DISC: Shape = ["circle", { cx: "8", cy: "8", r: "8", fill: "currentColor" }];
const RING: Shape = ["circle", { cx: "8", cy: "8", r: "7", fill: "none", stroke: "currentColor", "stroke-width": "2" }];
const whiteLine = (d: string): Shape => ["path", { d, fill: "none", stroke: "#fff", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" }];
const colouredLine = (d: string): Shape => ["path", { d, fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" }];

const SHAPES: Record<PipelineStatus, Shape[]> = {
  succeeded: [DISC, whiteLine("M4.5 8.3l2.3 2.3 4.7-5")],
  failed: [DISC, whiteLine("M5.5 5.5l5 5M10.5 5.5l-5 5")],
  running: [["circle", { cx: "8", cy: "8", r: "6.5", fill: "none", stroke: "currentColor", "stroke-width": "2.5", "stroke-dasharray": "28 13", "stroke-linecap": "round" }]],
  queued: [RING, colouredLine("M8 4.5V8l2.5 1.5")],
  notStarted: [RING],
  expired: [DISC, whiteLine("M8 4v5M8 11.9v.1")],
};

export function createPipelineStatusIcon(document: Document, status: PipelineStatus, pullRequestId: number): SVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("class", PIPELINE_STATUS_ICON_CLASS);
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", LABELS[status]);
  icon.dataset.status = status;
  icon.dataset.pullRequestId = String(pullRequestId);

  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = LABELS[status];
  icon.append(title);

  for (const [tag, attributes] of SHAPES[status]) {
    const shape = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    icon.append(shape);
  }
  return icon;
}
