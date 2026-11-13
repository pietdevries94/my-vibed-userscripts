// The card on a pull request's Overview with the checks' warnings and errors. Its
// markup copies Azure DevOps's status card, so its own styles apply.
import type { IssueCounts, RunIssue } from "./pipeline-issues.ts";
import {
  createElement,
  createIssueBox,
  createKindIcon,
  fillIssueLink,
  issueSummary,
  worstKindOf,
  wrapIn,
} from "./pipeline-issue-list.ts";
import type { ElementSpec } from "./pipeline-issue-list.ts";
import type { PipelineCheck } from "./pipeline-checks.ts";
import { pipelineLogPath } from "./pipeline-run-link.ts";

const OVERVIEW_ISSUES_CLASS = "fix-ado-overview-issues";

/** A check whose latest run has issues, as the card shows it. */
interface CheckIssues {
  check: PipelineCheck;
  /** The run's warnings and errors, without the errors the checks area shows. */
  counts: IssueCounts;
  issues: RunIssue[];
}

/** What the card shows, and where its links go. */
interface IssuesCardContent {
  apiBasePath: string;
  project: string;
  checks: CheckIssues[];
}

/** The log of the issue's step, or its run when it has no step. */
function runLinkOf(
  { apiBasePath, project }: IssuesCardContent,
  buildId: number,
  { jobId, stepId }: RunIssue,
): string {
  return jobId !== null && stepId !== null
    ? pipelineLogPath(apiBasePath, project, { buildId, jobId, stepId })
    : `${apiBasePath}/${encodeURIComponent(project)}/_build/results?buildId=${buildId}`;
}

function createCheckIssueBox(
  document: Document,
  content: IssuesCardContent,
  { check, counts, issues }: CheckIssues,
): HTMLElement {
  return createIssueBox(document, {
    createLink: (issue) => {
      const link = document.createElement("a");
      link.href = runLinkOf(content, check.buildId, issue);
      return fillIssueLink(link, issue);
    },
    details: issueSummary([counts]),
    issues,
    title: check.name,
  });
}

function headingOf(checks: CheckIssues[]): string {
  const runs = checks.length === 1 ? "the latest run" : "the latest runs";
  return `${issueSummary(checks.map(({ counts }) => counts))} in ${runs}`;
}

/** Azure DevOps's status card around its rows, innermost first. */
const CARD_WRAPPERS: ElementSpec[] = [
  { className: "flex-column flex-grow scroll-hidden", tag: "div" },
  { className: "bolt-card-content flex-row flex-grow bolt-default-horizontal-spacing", tag: "div" },
  {
    className: `bolt-table-card bolt-card flex-column depth-8 bolt-card-white ${OVERVIEW_ISSUES_CLASS}`,
    role: "region",
    tag: "section",
  },
];

/** The heading row, as on Azure DevOps's status card: a large status icon and a line of text. */
function createHeading(document: Document, checks: CheckIssues[]): HTMLElement {
  const heading = createElement(document, {
    className: "fix-ado-overview-issues-heading",
    tag: "span",
    text: headingOf(checks),
  });
  const text = wrapIn(document, heading, [
    { className: "flex-column flex-grow scroll-hidden", tag: "div" },
  ]);
  const row = createElement(document, {
    className: "flex-row flex-center rhythm-horizontal-8",
    tag: "div",
  });
  const kind = worstKindOf(checks.flatMap(({ issues }) => issues));
  row.append(createKindIcon(document, kind, "large"), text);
  return row;
}

/** A card like Azure DevOps's status card, with a box per check, as its check list has. */
function createIssuesCard(document: Document, content: IssuesCardContent): HTMLElement {
  const { checks } = content;
  const rows = createElement(document, {
    className: "padding-vertical-16 padding-horizontal-20 rhythm-vertical-16",
    tag: "div",
  });
  rows.append(
    createHeading(document, checks),
    ...checks.map((checkIssues) => createCheckIssueBox(document, content, checkIssues)),
  );
  const block = wrapIn(document, rows, CARD_WRAPPERS);
  block.setAttribute("aria-label", "Pipeline warnings and errors");
  block.dataset.fixAdoRendered = JSON.stringify(checks);
  return block;
}

export type { CheckIssues };
export { OVERVIEW_ISSUES_CLASS, createIssuesCard };
