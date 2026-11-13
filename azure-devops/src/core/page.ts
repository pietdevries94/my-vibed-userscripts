import type { PullRequestListPage, PullRequestRef } from "../pull-requests/pull-request-link.ts";
import {
  isPullRequestInboxLocation,
  parsePullRequestHref,
  parsePullRequestListLocation,
} from "../pull-requests/pull-request-link.ts";
import { isBoardLocation } from "../boards/board.ts";

/** The Azure DevOps page the browser shows, as far as the features care. */
type Page =
  | { kind: "board" }
  | { kind: "pull-request-list"; listPage: PullRequestListPage }
  | { kind: "pull-request-inbox" }
  | { kind: "pull-request"; pullRequest: PullRequestRef }
  | { kind: "other" };

function parsePage(location: { pathname: string; search: string }, basePath: string): Page {
  if (isBoardLocation(location)) {
    return { kind: "board" };
  }
  const listPage = parsePullRequestListLocation(location, basePath);
  if (listPage) {
    return { kind: "pull-request-list", listPage };
  }
  if (isPullRequestInboxLocation(location)) {
    return { kind: "pull-request-inbox" };
  }
  const pullRequest = parsePullRequestHref(location.pathname, basePath);
  return pullRequest ? { kind: "pull-request", pullRequest } : { kind: "other" };
}

/** The pull request the page shows, or null on any other page. */
function pullRequestOf(page: Page): PullRequestRef | null {
  return page.kind === "pull-request" ? page.pullRequest : null;
}

export type { Page };
export { parsePage, pullRequestOf };
