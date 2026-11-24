// The work items linked to the listed pull requests, invented from each pull request's id:
// none, one or two in turn. The captures keep no links.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";

const LINK_PATTERNS = 3;
const FIRST_WORK_ITEM_ID = 5000;
/** Room for each pull request's work item ids. */
const IDS_PER_PULL_REQUEST = 10;
const INVENTED_TITLES = [
  "Let customers reset their password by email",
  "Show the delivery date on the order confirmation page, also for orders that ship in parts",
  "Fix the rounding of discounts in the basket",
];

function linkedWorkItemIds(pullRequestId: number): number[] {
  const count = pullRequestId % LINK_PATTERNS;
  return Array.from(
    { length: count },
    (_entry, index) => FIRST_WORK_ITEM_ID + pullRequestId * IDS_PER_PULL_REQUEST + index,
  );
}

function linkedWorkItemsResponse(_request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const value = linkedWorkItemIds(Number(match.groups?.id)).map((id) => ({
    id: String(id),
    url: `http://localhost/fake-org/_apis/wit/workItems/${id}`,
  }));
  return jsonResponse({ count: value.length, value });
}

/** True for the script's request for a work item's title. */
const isWorkItemTitleRequest = (request: FakeRequest): boolean =>
  request.url.searchParams.get("fields") === "System.Title";

function workItemTitlesResponse(request: FakeRequest): FakeResponse {
  const ids = (request.url.searchParams.get("ids") ?? "").split(",").map(Number);
  const value = ids.map((id) => ({
    fields: { "System.Title": INVENTED_TITLES[id % INVENTED_TITLES.length] },
    id,
  }));
  return jsonResponse({ count: value.length, value });
}

export { isWorkItemTitleRequest, linkedWorkItemsResponse, workItemTitlesResponse };
