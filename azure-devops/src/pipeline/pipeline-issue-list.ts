// How a run's warnings and errors show. The markup copies Azure DevOps's own check list
// on a pull request's Overview, with its class names, so its own styles apply: a box
// with a header row, and per issue its job and step, then its log line in dark output.
// The tree of the Pipeline tab gets counts per stage, job and step.
import type { IssueCounts, IssueKind, RunIssue } from "./pipeline-issues.ts";
import { sumIssueCounts } from "./pipeline-issues.ts";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Azure DevOps's status icon sizes: a small one in rows, a large one for a card's heading. */
type IconSize = "small" | "large";

/** Each size in pixels, the side of its drawing, and its margin class. From azure-devops-ui. */
const ICON_SIZES = {
  large: { className: " margin-4", drawing: 32, pixels: 24 },
  small: { className: "", drawing: 16, pixels: 16 },
} as const;

/** Azure DevOps's status icon marks, from azure-devops-ui. */
const ICON_MARKS = {
  error: {
    large:
      "M21.99 9.99a1.5 1.5 0 0 0-2.122 0L16 13.856 12.132 9.99a1.5 1.5 0 0 0-2.121 2.122l3.868 3.868-3.89 3.889a1.5 1.5 0 0 0 2.122 2.121L16 18.1l3.89 3.89a1.5 1.5 0 0 0 2.12-2.122l-3.889-3.89 3.868-3.867a1.5 1.5 0 0 0 0-2.122z",
    small:
      "M10.984 5.004a.9.9 0 0 1 0 1.272L9.27 7.99l1.74 1.741a.9.9 0 1 1-1.272 1.273l-1.74-1.741-1.742 1.74a.9.9 0 1 1-1.272-1.272l1.74-1.74-1.713-1.714a.9.9 0 0 1 1.273-1.273l1.713 1.713 1.714-1.713a.9.9 0 0 1 1.273 0z",
  },
  warning: {
    large:
      "M16 7a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-3 0v-9A1.5 1.5 0 0 1 16 7zm-1.5 16a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z",
    small:
      "M8.91 3.9a.9.9 0 0 0-1.8 0v4.7a.9.9 0 1 0 1.8 0V3.9zm-.95 8.65a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z",
  },
} as const;
/** Azure DevOps's status class for each kind. */
const KIND_STATUSES = { error: "failed", warning: "warning" } as const;
const KIND_LABELS = { error: "Error", warning: "Warning" } as const;

/** An element to make: its tag and classes, and its text or role when it has one. */
interface ElementSpec {
  tag: string;
  className: string;
  text?: string;
  role?: string;
}

/** Azure DevOps's list around a single row, outermost last, as its check list has it. */
const LIST_ROW_WRAPPERS: ElementSpec[] = [
  { className: "bolt-list-cell-content flex-row", tag: "div" },
  { className: "bolt-list-cell", tag: "td" },
  { className: "bolt-list-row first-row", role: "listitem", tag: "tr" },
  { className: "relative", tag: "tbody" },
  {
    className: "preview-check-list bolt-list body-m relative scroll-hidden",
    role: "list",
    tag: "table",
  },
  { className: "status-details-container fix-ado-issue-box", tag: "div" },
];

function countText(count: number, kind: IssueKind): string {
  return `${count} ${kind}${count === 1 ? "" : "s"}`;
}

/** "1 error, 2 warnings" for the stages or other parts together, leaving out a kind without issues. */
function issueSummary(parts: IssueCounts[]): string {
  const { errorCount, warningCount } = sumIssueCounts(parts);
  return [
    ...(errorCount > 0 ? [countText(errorCount, "error")] : []),
    ...(warningCount > 0 ? [countText(warningCount, "warning")] : []),
  ].join(", ");
}

/** An error when there is one, else a warning. */
function worstKindOf(issues: RunIssue[]): IssueKind {
  return issues.some((issue) => issue.kind === "error") ? "error" : "warning";
}

function createElement(
  document: Document,
  { className, role, tag, text }: ElementSpec,
): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) {
    created.textContent = text;
  }
  if (role !== undefined) {
    created.setAttribute("role", role);
  }
  return created;
}

/** The content inside these wrappers, the first one innermost. Returns the outermost. */
function wrapIn(document: Document, content: Element, wrappers: ElementSpec[]): HTMLElement {
  let wrapped = content;
  for (const wrapper of wrappers) {
    const outer = createElement(document, wrapper);
    outer.append(wrapped);
    wrapped = outer;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every wrapper is an HTML element
  return wrapped as HTMLElement;
}

function setAttributes(element: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

/** Azure DevOps's status icon for an error or a warning. */
function createKindIcon(document: Document, kind: IssueKind, size: IconSize): SVGElement {
  const { className, drawing, pixels } = ICON_SIZES[size];
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  setAttributes(icon, {
    "aria-label": KIND_LABELS[kind],
    class: `bolt-status flex-noshrink ${KIND_STATUSES[kind]}${className} fix-ado-kind-icon`,
    "data-kind": kind,
    height: String(pixels),
    role: "img",
    viewBox: `0 0 ${drawing} ${drawing}`,
    width: String(pixels),
  });
  const circle = document.createElementNS(SVG_NAMESPACE, "circle");
  const middle = String(drawing / 2);
  setAttributes(circle, { cx: middle, cy: middle, r: middle });
  const mark = document.createElementNS(SVG_NAMESPACE, "path");
  setAttributes(mark, { d: ICON_MARKS[kind][size], fill: "#fff" });
  icon.append(circle, mark);
  return icon;
}

/** The error and warning counts of a stage, job or step, without the kinds it has none of. */
function createIssueCounts(document: Document, counts: IssueCounts): HTMLElement[] {
  return (["error", "warning"] as const).flatMap((kind) => {
    const count = kind === "error" ? counts.errorCount : counts.warningCount;
    if (count === 0) {
      return [];
    }
    const text = String(count);
    const badge = createElement(document, { className: "fix-ado-issue-count", tag: "span", text });
    badge.dataset.kind = kind;
    badge.setAttribute("aria-label", countText(count, kind));
    badge.title = countText(count, kind);
    return [badge];
  });
}

/** An issue's log line as Azure DevOps shows it: the line number, then the message. */
function createOutputLine(document: Document, issue: RunIssue): HTMLElement {
  const line = createElement(document, {
    className: "flex-row monospaced-m dark-build-output fix-ado-issue-output",
    tag: "div",
  });
  if (issue.lineNumber !== null) {
    const className = "line-number padding-horizontal-16";
    line.append(createElement(document, { className, tag: "div", text: String(issue.lineNumber) }));
  }
  const textClass = issue.kind === "error" ? "error-text" : "fix-ado-warning-text";
  const className = `${textClass} word-break fix-ado-issue-message`;
  line.append(createElement(document, { className, tag: "div", text: issue.message }));
  return line;
}

/**
 * Fills a link with an issue: its job and step, then its log line. The caller sets
 * where the link goes, and may handle the click itself.
 */
function fillIssueLink(link: HTMLAnchorElement, issue: RunIssue): HTMLAnchorElement {
  const { ownerDocument: document } = link;
  link.className =
    "bolt-table-link full-width-link-no-padding no-underline-link bolt-link fix-ado-issue";
  link.dataset.kind = issue.kind;
  const place = createElement(document, {
    className:
      "padding-horizontal-16 padding-vertical-8 text-ellipsis separator-line-top secondary-text body-s fix-ado-issue-place",
    tag: "div",
    text: issue.place.join(" / "),
  });
  const output = createElement(document, { className: "flex-column", tag: "div" });
  output.append(createOutputLine(document, issue));
  link.append(place, output);
  return link;
}

interface IssueBox {
  /** The name in the header row. */
  title: string;
  /** The grey text after it, or null for none. */
  details: string | null;
  issues: RunIssue[];
  /** The issue's link, filled by `fillIssueLink`. */
  createLink: (issue: RunIssue) => HTMLAnchorElement;
}

function createBoxHeader(document: Document, box: IssueBox): HTMLElement {
  const text = createElement(document, {
    className:
      "pr-completion-status-header flex-row flex-center flex-grow rhythm-horizontal-8 text-ellipsis",
    tag: "div",
  });
  const { title } = box;
  text.append(
    createElement(document, {
      className: "text-ellipsis fix-ado-issue-box-title",
      tag: "span",
      text: title,
    }),
  );
  if (box.details !== null) {
    const className = "secondary-text fix-ado-issue-box-details";
    text.append(createElement(document, { className, tag: "span", text: box.details }));
  }
  const header = createElement(document, {
    className:
      "flex-row flex-grow flex-center padding-horizontal-16 rhythm-horizontal-8 fix-ado-issue-box-header",
    tag: "div",
  });
  header.append(createKindIcon(document, worstKindOf(box.issues), "small"), text);
  return header;
}

/** A box like Azure DevOps's check list: a header row, then a link per issue. */
function createIssueBox(document: Document, box: IssueBox): HTMLElement {
  const content = createElement(document, {
    className: "flex-column flex-grow text-ellipsis",
    tag: "div",
  });
  const links = box.issues.map((issue) => box.createLink(issue));
  content.append(createBoxHeader(document, box), ...links);
  return wrapIn(document, content, LIST_ROW_WRAPPERS);
}

export type { ElementSpec, IssueBox };
export {
  createElement,
  createIssueBox,
  createIssueCounts,
  createKindIcon,
  fillIssueLink,
  issueSummary,
  worstKindOf,
  wrapIn,
};
