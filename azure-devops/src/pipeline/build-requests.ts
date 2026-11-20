// The client's requests for pipeline runs: the runs of a pull request, and the pipeline
// a run belongs to.
import { getJson, sendRequest } from "../core/ado-request.ts";
import type { AdoClientOptions } from "../core/ado-request.ts";
import type { PullRequestBuild } from "./pipeline-checks.ts";

interface PullRequestBuildsResponse {
  builds: PullRequestBuild[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

/** A pipeline, which Azure DevOps's API calls a build definition. */
interface BuildPipeline {
  id: number;
  name: string;
}

interface BuildRequests {
  /** The pipeline runs of a pull request, newest first. */
  getPullRequestBuilds: (
    project: string,
    pullRequestId: number,
  ) => Promise<PullRequestBuildsResponse>;
  /** The pipeline of a run. Throws when Azure DevOps does not tell. */
  getBuildPipeline: (project: string, buildId: number) => Promise<BuildPipeline>;
}

/** The runs of one pull request that the Pipeline tab lists. */
const MAX_PULL_REQUEST_BUILDS = 50;

async function getPullRequestBuilds(
  options: AdoClientOptions,
  { project, pullRequestId }: { project: string; pullRequestId: number },
): Promise<PullRequestBuildsResponse> {
  const branchName = encodeURIComponent(`refs/pull/${pullRequestId}/merge`);
  const { body, retryAfterSeconds } = await getJson(
    options,
    `/${encodeURIComponent(project)}/_apis/build/builds?branchName=${branchName}` +
      `&queryOrder=queueTimeDescending&$top=${MAX_PULL_REQUEST_BUILDS}&api-version=7.1`,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return { builds: (body.value ?? []) as PullRequestBuild[], retryAfterSeconds };
}

function isBuildPipeline(value: unknown): value is BuildPipeline {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

async function getBuildPipeline(
  options: AdoClientOptions,
  project: string,
  buildId: number,
): Promise<BuildPipeline> {
  const response = await sendRequest(
    options,
    `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`,
  );
  const body: unknown = await response.json();
  const definition =
    typeof body === "object" && body !== null && "definition" in body ? body.definition : null;
  if (!isBuildPipeline(definition)) {
    throw new Error(`Run ${buildId} has no pipeline in Azure DevOps's answer`);
  }
  return { id: definition.id, name: definition.name };
}

function createBuildRequests(options: AdoClientOptions): BuildRequests {
  return {
    getBuildPipeline: async (project, buildId) => getBuildPipeline(options, project, buildId),
    getPullRequestBuilds: async (project, pullRequestId) =>
      getPullRequestBuilds(options, { project, pullRequestId }),
  };
}

export type { BuildPipeline, BuildRequests, PullRequestBuildsResponse };
export { createBuildRequests };
