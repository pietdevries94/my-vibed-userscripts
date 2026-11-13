// The warnings and errors of a pipeline run, from its timeline. Azure DevOps lists
// them per record: a stage, phase, job or step. A stage may repeat an issue of its job;
// that issue counts once, at the job.
import type { TimelineRecord } from "./pipeline-timeline.ts";

type IssueKind = "error" | "warning";

/** An issue as a timeline record lists it. */
interface TimelineIssue {
  /** `error` or `warning`. */
  type: string;
  message?: string | null;
  /** Where the issue is in the step's log, for an issue of a step. */
  data?: { logFileLineNumber?: string } | null;
}

interface IssueCounts {
  errorCount: number;
  warningCount: number;
}

/** A warning or error of a run, with the stage, job and step it belongs to. */
interface RunIssue {
  kind: IssueKind;
  message: string;
  /**
   * Where it is, as Azure DevOps names it: its job and step, or its stage for an issue
   * outside a job. A run without stages has no stage name.
   */
  place: string[];
  /** Its line in the step's log, or null when Azure DevOps does not tell. */
  lineNumber: number | null;
  stageId: string;
  jobId: string | null;
  stepId: string | null;
}

/** Where an issue sits in the run tree: its stage, and its job and step when it has them. */
interface IssueSpot {
  stage: { id: string; name: string | null };
  job: { id: string; name: string } | null;
  step: { id: string; name: string } | null;
}

const NO_ISSUES: IssueCounts = { errorCount: 0, warningCount: 0 };
const COUNT_FIELDS = { error: "errorCount", warning: "warningCount" } as const;

function isIssueKind(type: string): type is IssueKind {
  return type === "error" || type === "warning";
}

function issueKey(issue: TimelineIssue): string {
  return `${issue.type}\n${issue.message ?? ""}`;
}

function childrenByParentOf(records: TimelineRecord[]): Map<string, TimelineRecord[]> {
  const children = new Map<string, TimelineRecord[]>();
  for (const record of records) {
    if (record.parentId !== null) {
      children.set(record.parentId, [...(children.get(record.parentId) ?? []), record]);
    }
  }
  return children;
}

function descendantsOf(
  record: TimelineRecord,
  childrenByParent: Map<string, TimelineRecord[]>,
): TimelineRecord[] {
  const descendants: TimelineRecord[] = [];
  for (const child of childrenByParent.get(record.id) ?? []) {
    descendants.push(child, ...descendantsOf(child, childrenByParent));
  }
  return descendants;
}

/** Each record's warnings and errors, without the ones a record below it lists too. */
function ownIssuesOf(records: TimelineRecord[]): Map<string, TimelineIssue[]> {
  const childrenByParent = childrenByParentOf(records);
  return new Map(
    records.map((record) => {
      const below = new Set(
        descendantsOf(record, childrenByParent).flatMap((descendant) =>
          (descendant.issues ?? []).map((issue) => issueKey(issue)),
        ),
      );
      const own = (record.issues ?? []).filter(
        (issue) => isIssueKind(issue.type) && !below.has(issueKey(issue)),
      );
      return [record.id, own];
    }),
  );
}

/**
 * How many issues of a kind a record has itself. Azure DevOps lists only the first
 * few, so its count can be higher than the list; repeats from below do not count.
 */
function ownCountOf(record: TimelineRecord, own: TimelineIssue[], kind: IssueKind): number {
  const listed = (record.issues ?? []).filter((issue) => issue.type === kind).length;
  const repeated = listed - own.filter((issue) => issue.type === kind).length;
  return Math.max(0, Math.max(record[COUNT_FIELDS[kind]] ?? 0, listed) - repeated);
}

/** Per record: its own warnings and errors, and those of every record below it. */
function issueCountsOf(records: TimelineRecord[]): Map<string, IssueCounts> {
  const childrenByParent = childrenByParentOf(records);
  const ownIssues = ownIssuesOf(records);
  const ownCounts = new Map(
    records.map((record) => {
      const own = ownIssues.get(record.id) ?? [];
      return [
        record.id,
        {
          errorCount: ownCountOf(record, own, "error"),
          warningCount: ownCountOf(record, own, "warning"),
        },
      ];
    }),
  );
  return new Map(
    records.map((record) => [
      record.id,
      sumIssueCounts(
        [record, ...descendantsOf(record, childrenByParent)].map(
          ({ id }) => ownCounts.get(id) ?? NO_ISSUES,
        ),
      ),
    ]),
  );
}

function sumIssueCounts(counts: IssueCounts[]): IssueCounts {
  const total = { ...NO_ISSUES };
  for (const count of counts) {
    total.errorCount += count.errorCount;
    total.warningCount += count.warningCount;
  }
  return total;
}

function runIssueOf(issue: TimelineIssue & { type: IssueKind }, spot: IssueSpot): RunIssue {
  const names = spot.job === null ? [spot.stage.name] : [spot.job.name, spot.step?.name];
  const place = names.filter((name) => name !== null && name !== undefined);
  const lineNumber = Number(issue.data?.logFileLineNumber ?? Number.NaN);
  return {
    jobId: spot.job?.id ?? null,
    kind: issue.type,
    lineNumber: Number.isInteger(lineNumber) ? lineNumber : null,
    message: issue.message ?? "",
    place,
    stageId: spot.stage.id,
    stepId: spot.step?.id ?? null,
  };
}

/** The issues of the records at one spot of the run tree. */
function runIssuesAt(spot: IssueSpot, issues: TimelineIssue[]): RunIssue[] {
  return issues.flatMap((issue) =>
    isIssueKind(issue.type) ? [runIssueOf({ ...issue, type: issue.type }, spot)] : [],
  );
}

/** A run's issues, errors first, then warnings, each in run order. */
function runIssuesOf(stages: { issues: RunIssue[] }[]): RunIssue[] {
  const issues = stages.flatMap((stage) => stage.issues);
  return [
    ...issues.filter((issue) => issue.kind === "error"),
    ...issues.filter((issue) => issue.kind === "warning"),
  ];
}

export type { IssueCounts, IssueKind, IssueSpot, RunIssue, TimelineIssue };
export { NO_ISSUES, issueCountsOf, runIssuesAt, ownIssuesOf, runIssuesOf, sumIssueCounts };
