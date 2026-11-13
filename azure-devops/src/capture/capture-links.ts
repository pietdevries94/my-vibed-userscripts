// The fake URLs a capture writes for Azure DevOps links. Dev file only.
import { apiBasePath, parsePullRequestHref } from "../pull-requests/pull-request-link.ts";
import type { PipelineRunLocation } from "../pipeline/pipeline-run-link.ts";
import type { Pseudonyms } from "../../../shared/dev/scrub/pseudonyms.ts";
import { parsePipelineRunLocation } from "../pipeline/pipeline-run-link.ts";

/** The organisation in every fake URL. */
const FAKE_ORGANISATION = "fake-org";

function fakePullRequestLink(url: URL, pseudonyms: Pseudonyms): string | null {
  const pullRequest = parsePullRequestHref(url.pathname, apiBasePath(location));
  if (pullRequest === null) {
    return null;
  }
  const project = pseudonyms.text(pullRequest.project, "pull request link project");
  const repository = pseudonyms.text(pullRequest.repository, "pull request link repository");
  const pullRequestId = pseudonyms.number(pullRequest.pullRequestId, "pull request link id");
  return `/${FAKE_ORGANISATION}/${project}/_git/${repository}/pullrequest/${pullRequestId}`;
}

function fakePipelineRunQuery(run: PipelineRunLocation, pseudonyms: Pseudonyms): string {
  const query = new URLSearchParams({
    buildId: String(pseudonyms.number(run.buildId, "pipeline run link build id")),
  });
  if (run.view !== "summary") {
    query.set("view", "logs");
  }
  if (run.jobId !== null && run.stepId !== null) {
    query.set("j", pseudonyms.guid(run.jobId, "pipeline run link job id"));
    query.set("t", pseudonyms.guid(run.stepId, "pipeline run link step id"));
  }
  return query.toString();
}

/** A pipeline run link keeps its build, view, job and step, as stand-ins. */
function fakePipelineRunLink(url: URL, pseudonyms: Pseudonyms): string | null {
  const run = parsePipelineRunLocation(url);
  const project = url.pathname.split("/_build/")[0]?.split("/").pop();
  if (run === null || project === undefined || project === "") {
    return null;
  }
  const fakeProject = pseudonyms.text(decodeURIComponent(project), "pipeline run link project");
  return `/${FAKE_ORGANISATION}/${fakeProject}/_build/results?${fakePipelineRunQuery(run, pseudonyms)}`;
}

function fakeLink(url: URL, pseudonyms: Pseudonyms): string | null {
  return fakePullRequestLink(url, pseudonyms) ?? fakePipelineRunLink(url, pseudonyms);
}

export { fakeLink };
