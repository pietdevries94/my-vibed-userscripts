// What a pull request capture takes along for a review: the pull request's threads,
// its iterations and the changes of the newest iteration. Dev file only.
import { AdoRequestError, sendRequest } from "../core/ado-request.ts";
import type { AdoClientOptions } from "../core/ado-request.ts";
import type { PullRequestRef } from "../pull-requests/pull-request-link.ts";

/** A response as it came, or its HTTP status when Azure DevOps refused. */
interface CapturedBody {
  body: unknown;
  httpStatus: number;
}

interface ReviewResponses {
  threads: CapturedBody;
  iterations: CapturedBody;
  /** Null when the pull request lists no iteration. */
  newestIterationChanges: CapturedBody | null;
  /** The threads as tracked to the newest iteration. Null when the pull request lists no iteration. */
  newestIterationThreads: CapturedBody | null;
}

const API_VERSION = "api-version=7.1";
const HTTP_OK = 200;

async function capturedBody(options: AdoClientOptions, path: string): Promise<CapturedBody> {
  try {
    const response = await sendRequest(options, path);
    const body: unknown = await response.json();
    return { body, httpStatus: HTTP_OK };
  } catch (error) {
    return { body: null, httpStatus: error instanceof AdoRequestError ? error.httpStatus : 0 };
  }
}

function iterationIdsOf({ body }: CapturedBody): number[] {
  if (typeof body !== "object" || body === null || !("value" in body)) {
    return [];
  }
  const iterations: unknown = body.value;
  return Array.isArray(iterations)
    ? iterations.flatMap((iteration: unknown) =>
        typeof iteration === "object" &&
        iteration !== null &&
        "id" in iteration &&
        typeof iteration.id === "number"
          ? [iteration.id]
          : [],
      )
    : [];
}

/** One request at a time, as the script sends them. */
async function reviewResponsesOf(
  options: AdoClientOptions,
  { project, pullRequestId, repository }: PullRequestRef,
): Promise<ReviewResponses> {
  const pullRequestPath = `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}`;
  const threads = await capturedBody(options, `${pullRequestPath}/threads?${API_VERSION}`);
  const iterations = await capturedBody(options, `${pullRequestPath}/iterations?${API_VERSION}`);
  const iterationIds = iterationIdsOf(iterations);
  if (iterationIds.length === 0) {
    return { iterations, newestIterationChanges: null, newestIterationThreads: null, threads };
  }
  const newestIteration = Math.max(...iterationIds);
  const newestIterationChanges = await capturedBody(
    options,
    `${pullRequestPath}/iterations/${newestIteration}/changes?${API_VERSION}`,
  );
  const newestIterationThreads = await capturedBody(
    options,
    `${pullRequestPath}/threads?$iteration=${newestIteration}&${API_VERSION}`,
  );
  return { iterations, newestIterationChanges, newestIterationThreads, threads };
}

export { reviewResponsesOf };
