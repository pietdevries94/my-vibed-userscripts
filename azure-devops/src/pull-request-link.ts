export interface PullRequestRef {
  project: string;
  repository: string;
  pullRequestId: number;
}

/**
 * Path prefix of the REST API. On dev.azure.com the organisation is the first
 * path segment. On {org}.visualstudio.com it is the subdomain.
 */
export function apiBasePath(location: { hostname: string; pathname: string }): string {
  const firstPathSegment = location.pathname.split("/")[1] ?? "";
  if (location.hostname.endsWith(".visualstudio.com")) {
    return firstPathSegment === "DefaultCollection" ? "/DefaultCollection" : "";
  }
  return `/${firstPathSegment}`;
}

export function parsePullRequestHref(href: string, apiBasePath: string): PullRequestRef | null {
  const segments = new URL(href, "https://relative.invalid").pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const gitIndex = segments.indexOf("_git");
  const pullRequestIndex = segments.indexOf("pullrequest");
  if (gitIndex < 0 || pullRequestIndex < 0) return null;
  const pullRequestId = Number(segments[pullRequestIndex + 1]);
  const repository = segments[gitIndex + 1];
  if (!Number.isInteger(pullRequestId) || repository === undefined) return null;
  const apiBaseSegmentCount = apiBasePath.split("/").filter(Boolean).length;
  // ADO omits the project segment when the repository has the project's name.
  const project = gitIndex > apiBaseSegmentCount ? segments[gitIndex - 1]! : repository;
  return { project, repository, pullRequestId };
}

export type PullRequestListStatus = "active" | "completed" | "abandoned";

export interface PullRequestListPage {
  project: string;
  repository: string;
  status: PullRequestListStatus;
}

/** The repository pull request list shown at this location, or null on any other page. */
export function parsePullRequestListLocation(
  location: { pathname: string; search: string },
  apiBasePath: string,
): PullRequestListPage | null {
  const segments = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const gitIndex = segments.indexOf("_git");
  const repository = segments[gitIndex + 1];
  if (gitIndex < 0 || repository === undefined || segments[gitIndex + 2] !== "pullrequests" || segments.length !== gitIndex + 3) return null;
  const apiBaseSegmentCount = apiBasePath.split("/").filter(Boolean).length;
  const project = gitIndex > apiBaseSegmentCount ? segments[gitIndex - 1]! : repository;
  const tab = new URLSearchParams(location.search).get("_a");
  const status = tab === "completed" || tab === "abandoned" ? tab : "active";
  return { project, repository, status };
}
