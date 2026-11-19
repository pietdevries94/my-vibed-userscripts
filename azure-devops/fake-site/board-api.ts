// The board's work item API: the cards' revisions, and invented updates for days in column.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { boardData } from "./data.ts";
import { currentWorkItem } from "./state.ts";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";

function workItemsResponse(request: FakeRequest): FakeResponse {
  const ids = (request.url.searchParams.get("ids") ?? "").split(",").map(Number);
  const { workItems } = boardData().data;
  const value = ids.map((id) => {
    const workItem = workItems.find((captured) => captured.id === id);
    if (workItem === undefined) {
      return null;
    }
    const { changedById, rev } = currentWorkItem(workItem);
    return { fields: { "System.ChangedBy": { id: changedById }, "System.Rev": rev }, id, rev };
  });
  return jsonResponse({ count: value.length, value });
}

const MS_PER_DAY = 86_400_000;
/** Spreads the cards over 0 to 24 days in their column. */
const DAYS_PER_ID = 7;
const FAKE_DAYS_IN_COLUMN_SPREAD = 25;
const DAYS_BEFORE_MOVE = 3;

/**
 * Captured dates are minutes apart, so the updates are invented: each card was
 * created, then moved to its column a number of days ago that its id decides.
 */
function workItemUpdatesResponse(_request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const id = Number(match.groups?.id);
  const daysInColumn = (id * DAYS_PER_ID) % FAKE_DAYS_IN_COLUMN_SPREAD;
  const movedAt = new Date(Date.now() - daysInColumn * MS_PER_DAY - MS_PER_DAY / 2).toISOString();
  const createdAt = new Date(Date.parse(movedAt) - DAYS_BEFORE_MOVE * MS_PER_DAY).toISOString();
  const value = [
    {
      fields: {
        "System.BoardColumn": { newValue: "text-new" },
        "System.ChangedDate": { newValue: createdAt },
      },
      id: 1,
      rev: 1,
    },
    {
      fields: {
        "System.BoardColumn": { newValue: "text-active", oldValue: "text-new" },
        "System.ChangedDate": { newValue: movedAt, oldValue: createdAt },
      },
      id: 2,
      rev: 2,
    },
  ];
  return jsonResponse({ count: value.length, value });
}

export { workItemUpdatesResponse, workItemsResponse };
