interface PullRequestRef {
  project: string;
  repository: string;
  pullRequestId: number;
}

/** A list location ends in `_git/<repository>/pullrequests`. */
const LIST_PATH_SEGMENTS_FROM_GIT = 3;

/**
 * Path prefix of the REST API. On dev.azure.com the organisation is the first
 * path segment. On {org}.visualstudio.com it is the subdomain.
 */
function apiBasePath(location: { hostname: string; pathname: string }): string {
  const firstPathSegment = location.pathname.split("/")[1] ?? "";
  if (location.hostname.endsWith(".visualstudio.com")) {
    return firstPathSegment === "DefaultCollection" ? "/DefaultCollection" : "";
  }
  return `/${firstPathSegment}`;
}

function pathSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

/** ADO omits the project segment when the repository has the project's name. */
function projectOf(segments: string[], gitIndex: number, basePath: string): string | undefined {
  const apiBaseSegmentCount = basePath.split("/").filter(Boolean).length;
  return gitIndex > apiBaseSegmentCount ? segments[gitIndex - 1] : segments[gitIndex + 1];
}

function parsePullRequestHref(href: string, basePath: string): PullRequestRef | null {
  const segments = pathSegments(new URL(href, "https://relative.invalid").pathname);
  const gitIndex = segments.indexOf("_git");
  const pullRequestIndex = segments.indexOf("pullrequest");
  const pullRequestId = Number(segments[pullRequestIndex + 1]);
  const repository = segments[gitIndex + 1];
  const project = projectOf(segments, gitIndex, basePath);
  const isPullRequestLink =
    gitIndex !== -1 && pullRequestIndex !== -1 && Number.isInteger(pullRequestId);
  if (!isPullRequestLink || repository === undefined || project === undefined) {
    return null;
  }
  return { project, pullRequestId, repository };
}

type PullRequestListStatus = "active" | "completed" | "abandoned";

interface PullRequestListPage {
  project: string;
  repository: string;
  status: PullRequestListStatus;
}

/** The repository pull request list shown at this location, or null on any other page. */
function parsePullRequestListLocation(
  location: { pathname: string; search: string },
  basePath: string,
): PullRequestListPage | null {
  const segments = pathSegments(location.pathname);
  const gitIndex = segments.indexOf("_git");
  const repository = segments[gitIndex + 1];
  if (
    gitIndex === -1 ||
    repository === undefined ||
    segments[gitIndex + 2] !== "pullrequests" ||
    segments.length !== gitIndex + LIST_PATH_SEGMENTS_FROM_GIT
  ) {
    return null;
  }
  const project = projectOf(segments, gitIndex, basePath) ?? repository;
  const tab = new URLSearchParams(location.search).get("_a");
  const status = tab === "completed" || tab === "abandoned" ? tab : "active";
  return { project, repository, status };
}

/** The pull request inbox across repositories: `<organisation>/_pulls`, or `<project>/_pulls`. */
function isPullRequestInboxLocation(location: { pathname: string }): boolean {
  return pathSegments(location.pathname).at(-1) === "_pulls";
}

export type { PullRequestListPage, PullRequestListStatus, PullRequestRef };
export {
  apiBasePath,
  isPullRequestInboxLocation,
  parsePullRequestHref,
  parsePullRequestListLocation,
};
