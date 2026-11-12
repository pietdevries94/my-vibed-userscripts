// The capture of a pull request page and a pipeline run page, with the policy
// evaluations and run timelines the Pipeline tab reads. Dev file only.
import { AdoRequestError, createAdoClient } from "./ado-client.ts";
import { apiBasePath, parsePullRequestHref } from "./pull-request-link.ts";
import type { AdoClient } from "./ado-client.ts";
import type { CapturePage } from "../../shared/dev/capture/capture.ts";
import type { PipelineRunView } from "./pipeline-run-link.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { Pseudonyms } from "../../shared/dev/scrub/pseudonyms.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import { parsePipelineRunLocation } from "./pipeline-run-link.ts";
import { pipelineChecksOf } from "./pipeline-checks.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

/** A response as the capture records it. A failed request keeps its HTTP status. */
interface CapturedResponse<Body> {
  body: Body | null;
  httpStatus: number;
  retryAfterSeconds: number | null;
}

const HTTP_OK = 200;
const PIPELINE_RUN_PAGE_NAMES: Record<PipelineRunView, string> = {
  log: "pipeline-log",
  steps: "pipeline-steps",
  summary: "pipeline-summary",
};

async function captured<Body>(
  request: () => Promise<{ body: Body; retryAfterSeconds: number | null }>,
): Promise<CapturedResponse<Body>> {
  try {
    const { body, retryAfterSeconds } = await request();
    return { body, httpStatus: HTTP_OK, retryAfterSeconds };
  } catch (error) {
    return error instanceof AdoRequestError
      ? { body: null, httpStatus: error.httpStatus, retryAfterSeconds: error.retryAfterSeconds }
      : { body: null, httpStatus: 0, retryAfterSeconds: null };
  }
}

async function evaluationsOf(
  client: AdoClient,
  pullRequest: PullRequestRef,
): Promise<CapturedResponse<{ value: PolicyEvaluation[] }>> {
  return captured(async () => {
    const { evaluations, retryAfterSeconds } = await client.getPolicyEvaluations(pullRequest);
    return { body: { value: evaluations }, retryAfterSeconds };
  });
}

interface RunsToCapture {
  project: string;
  buildIds: number[];
}

/** The timelines of these runs, by stand-in build id. One request at a time. */
async function timelinesOf(
  client: AdoClient,
  { buildIds, project }: RunsToCapture,
  pseudonyms: Pseudonyms,
): Promise<Record<number, unknown>> {
  const timelines: Record<number, unknown> = {};
  for (const buildId of buildIds) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one request at a time, as the script sends them
    timelines[pseudonyms.number(buildId, "build id")] = await captured(async () => {
      const { records, retryAfterSeconds } = await client.getTimeline(project, buildId);
      return { body: { records }, retryAfterSeconds };
    });
  }
  return timelines;
}

function clientFor(
  fetch: Parameters<CapturePage["collect"]>[0],
  pseudonyms: Pseudonyms,
): AdoClient {
  const basePath = apiBasePath(location);
  pseudonyms.text(basePath.replaceAll("/", ""), "organisation");
  return createAdoClient({ apiBasePath: basePath, fetch, origin: location.origin });
}

/** The pull request page: its checks, the policy evaluations behind them, and their runs. */
function pullRequestPage(pullRequest: PullRequestRef): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      const client = clientFor(fetch, pseudonyms);
      const evaluations = await evaluationsOf(client, pullRequest);
      const buildIds = pipelineChecksOf(evaluations.body?.value ?? []).map(
        (check) => check.buildId,
      );
      const timelinesByBuildId = await timelinesOf(
        client,
        { buildIds, project: pullRequest.project },
        pseudonyms,
      );
      return { data: { evaluations, timelinesByBuildId }, meta: {} };
    },
    name: "pr-detail",
    root: withoutScriptMarks(document.body),
  };
}

/** A pipeline run page, with the run's timeline. */
function pipelineRunPage(view: PipelineRunView, buildId: number): CapturePage {
  return {
    async collect(fetch, pseudonyms) {
      const client = clientFor(fetch, pseudonyms);
      const project = decodeURIComponent(
        location.pathname.split("/_build/")[0]?.split("/").pop() ?? "",
      );
      const timelinesByBuildId = await timelinesOf(
        client,
        { buildIds: [buildId], project },
        pseudonyms,
      );
      return { data: { timelinesByBuildId }, meta: {} };
    },
    name: PIPELINE_RUN_PAGE_NAMES[view],
    root: withoutScriptMarks(document.body),
  };
}

function pullRequestOrRunPage(location: Location): CapturePage | null {
  const pullRequest = parsePullRequestHref(location.pathname, apiBasePath(location));
  if (pullRequest !== null) {
    return pullRequestPage(pullRequest);
  }
  const run = parsePipelineRunLocation(location);
  return run === null ? null : pipelineRunPage(run.view, run.buildId);
}

export { evaluationsOf, pullRequestOrRunPage };
