// The fake URLs a capture writes for Azure DevOps links. Dev file only.
import { apiBasePath, parsePullRequestHref } from "../pull-requests/pull-request-link.ts";
import { parsePipelineRunLocation, pipelineRunTabViewOf } from "../pipeline/pipeline-run-link.ts";
import type { PipelineRunLocation } from "../pipeline/pipeline-run-link.ts";
import type { Pseudonyms } from "../../../shared/dev/scrub/pseudonyms.ts";

/** The organisation in every fake URL. */
const FAKE_ORGANISATION = "fake-org";
/** The pull request tabs a fake link keeps in `_a`. */
const PULL_REQUEST_TABS = new Set(["overview", "files", "updates", "commits"]);

function fakePullRequestLink(url: URL, pseudonyms: Pseudonyms): string | null {
  const pullRequest = parsePullRequestHref(url.pathname, apiBasePath(location));
  if (pullRequest === null) {
    return null;
  }
  const project = pseudonyms.text(pullRequest.project, "pull request link project");
  const repository = pseudonyms.text(pullRequest.repository, "pull request link repository");
  const pullRequestId = pseudonyms.number(pullRequest.pullRequestId, "pull request link id");
  const tab = url.searchParams.get("_a");
  const query = tab !== null && PULL_REQUEST_TABS.has(tab) ? `?_a=${tab}` : "";
  return `/${FAKE_ORGANISATION}/${project}/_git/${repository}/pullrequest/${pullRequestId}${query}`;
}

/**
 * Microsoft's own run page tabs: a plain word such as "codecoverage-tab", or a
 * contribution id such as "ms.vss-build-web.run-extensions-tab". Another extension's tab
 * names its publisher, so it gets a stand-in.
 */
const MICROSOFT_RUN_TAB_VIEW = /^(?:[a-z-]{1,40}|ms\.vss-[\w.-]{1,80})$/u;

function fakeRunTabView(tab: string, pseudonyms: Pseudonyms): string {
  return MICROSOFT_RUN_TAB_VIEW.test(tab) ? tab : pseudonyms.text(tab, "pipeline run link tab");
}

function fakePipelineRunQuery(url: URL, run: PipelineRunLocation, pseudonyms: Pseudonyms): string {
  const query = new URLSearchParams({
    buildId: String(pseudonyms.number(run.buildId, "pipeline run link build id")),
  });
  const tab = pipelineRunTabViewOf(url);
  if (run.view !== "summary") {
    query.set("view", "logs");
  } else if (tab !== null) {
    query.set("view", fakeRunTabView(tab, pseudonyms));
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
  return `/${FAKE_ORGANISATION}/${fakeProject}/_build/results?${fakePipelineRunQuery(url, run, pseudonyms)}`;
}

function fakeLink(url: URL, pseudonyms: Pseudonyms): string | null {
  return fakePullRequestLink(url, pseudonyms) ?? fakePipelineRunLink(url, pseudonyms);
}

export { fakeLink };
