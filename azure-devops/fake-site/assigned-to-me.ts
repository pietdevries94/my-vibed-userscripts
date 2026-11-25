// The pull requests assigned to me on the pull request lists, as the capture recorded them
// with my votes, and my user id there. The capture of the list page decides both.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";
import { pullRequestPageData } from "./data.ts";

const LIST_PAGE_PATH = /\/(?:pullrequests|_pulls)$/u;

function isAssignedToMeRequest(request: FakeRequest): boolean {
  return request.url.searchParams.has("searchCriteria.reviewerId");
}

/** The captured user id, for a request from a pull request list whose capture has one. */
function listUserId(request: FakeRequest): string | null {
  const refererPath = request.refererPath ?? "";
  if (!LIST_PAGE_PATH.test(refererPath)) {
    return null;
  }
  const page = refererPath.endsWith("/_pulls") ? "pr-inbox" : "pr-list";
  return pullRequestPageData(page).data.assignedToMe?.authenticatedUserId ?? null;
}

function assignedToMeResponse(page: "pr-list" | "pr-inbox"): FakeResponse {
  const value = pullRequestPageData(page).data.assignedToMe?.pullRequests ?? [];
  return jsonResponse({ count: value.length, value });
}

export { assignedToMeResponse, isAssignedToMeRequest, listUserId };
