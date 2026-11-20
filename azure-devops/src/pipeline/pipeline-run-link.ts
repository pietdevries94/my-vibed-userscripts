/** Which part of a pipeline run page is open. */
type PipelineRunView = "summary" | "steps" | "log";

interface PipelineRunLocation {
  buildId: number;
  view: PipelineRunView;
  /** The job of the open log, or null when no log is open. */
  jobId: string | null;
  /** The step of the open log, or null when no log is open. */
  stepId: string | null;
}

const RUN_PATH_END = "/_build/results";

/** A pipeline run page, `<project>/_build/results?buildId=<id>`, or null on any other page. */
function parsePipelineRunLocation(location: {
  pathname: string;
  search: string;
}): PipelineRunLocation | null {
  const query = new URLSearchParams(location.search);
  const buildId = Number(query.get("buildId") ?? Number.NaN);
  if (!location.pathname.endsWith(RUN_PATH_END) || !Number.isInteger(buildId)) {
    return null;
  }
  const jobId = query.get("j");
  const stepId = query.get("t");
  if (query.get("view") !== "logs") {
    return { buildId, jobId: null, stepId: null, view: "summary" };
  }
  return jobId !== null && stepId !== null
    ? { buildId, jobId, stepId, view: "log" }
    : { buildId, jobId: null, stepId: null, view: "steps" };
}

/**
 * The tab a run page shows, by its `view`, such as "codecoverage-tab", or null on its
 * Summary and its logs.
 */
function pipelineRunTabOf(location: { search: string }): string | null {
  const view = new URLSearchParams(location.search).get("view");
  return view === null || view === "" || view === "logs" || view === "results" ? null : view;
}

/** A run's page, on its summary. */
function pipelineRunPath(apiBasePath: string, project: string, buildId: number): string {
  return `${apiBasePath}/${encodeURIComponent(project)}${RUN_PATH_END}?buildId=${buildId}`;
}

/** One step's log in a run. */
function pipelineLogPath(
  apiBasePath: string,
  project: string,
  { buildId, jobId, stepId }: { buildId: number; jobId: string; stepId: string },
): string {
  const step = `j=${encodeURIComponent(jobId)}&t=${encodeURIComponent(stepId)}`;
  return `${pipelineRunPath(apiBasePath, project, buildId)}&view=logs&${step}`;
}

export type { PipelineRunLocation, PipelineRunView };
export { parsePipelineRunLocation, pipelineLogPath, pipelineRunPath, pipelineRunTabOf };
