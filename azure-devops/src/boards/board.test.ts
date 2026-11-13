import type { BoardSnapshot, BoardWorkItem } from "./board.ts";
import { findBoardCardIds, hasBoardChanged, isBoardLocation, watchBoard } from "./board.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

const ME = "my-user-id";
const snapshot = (workItems: BoardWorkItem[], myUserId: string | null = ME): BoardSnapshot => ({
  myUserId,
  workItems: new Map(workItems.map((workItem) => [workItem.id, workItem])),
});
const workItem = (
  id: number,
  rev: number,
  changedById: string | null = "someone-else",
): BoardWorkItem => ({ changedById, id, rev });
const isChange = (
  loaded: BoardWorkItem[],
  current: BoardWorkItem[],
  myUserId: string | null = ME,
): boolean => hasBoardChanged(snapshot(loaded, myUserId), snapshot(current, myUserId));

test("recognises a board location", () => {
  assert.equal(
    isBoardLocation({ pathname: "/my-org/my-project/_boards/board/t/My%20Team/User%20Stories" }),
    true,
  );
  assert.equal(
    isBoardLocation({
      pathname: "/my-org/my-project/_backlogs/backlog/t/My%20Team/User%20Stories",
    }),
    false,
  );
  assert.equal(
    isBoardLocation({ pathname: "/my-org/my-project/_git/my-repo/pullrequests" }),
    false,
  );
});

test("finds the work item id of each card once", () => {
  const { document } = new JSDOM(`
    <div class="wit-card" data-itemid="101"></div><div class="wit-card" data-itemid="102"></div>
    <div class="wit-card" data-itemid="101"></div><div class="wit-card" data-itemid="new"></div><div class="wit-card"></div>
  `).window;
  assert.deepEqual(findBoardCardIds(document), [101, 102]);
});

test("an unchanged board has not changed", () => {
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 5)]), false);
});

test("a card changed by someone else is a change", () => {
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 6)]), true);
});

test("my own change is not a change", () => {
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 6, ME)]), false);
});

test("without knowing who I am, every change counts", () => {
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 6, ME)], null), true);
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 6, null)], null), true);
});

test("a card that was not there at load, or is gone now, is not a change", () => {
  assert.equal(isChange([workItem(1, 5)], [workItem(1, 5), workItem(2, 1)]), false);
  assert.equal(isChange([workItem(1, 5), workItem(2, 1)], [workItem(1, 5)]), false);
});

test("watching a board fetches its cards and starts comparing cards that appear later", async () => {
  const requestedIds: number[][] = [];
  let revOfSecondCard = 1;
  const client = {
    getAuthenticatedUserId: async (): Promise<string> => ME,
    async getWorkItems(
      ids: number[],
    ): Promise<{ retryAfterSeconds: null; workItems: BoardWorkItem[] }> {
      requestedIds.push(ids);
      return {
        retryAfterSeconds: null,
        workItems: ids.map((id) => workItem(id, id === 2 ? revOfSecondCard : 5)),
      };
    },
  };
  const location = { pathname: "/org/project/_boards/board/t/Team/Stories", search: "?filter=1" };

  const loaded = await watchBoard(client, location, [1]).fetchSnapshot();
  assert.deepEqual(requestedIds, [[1]]);
  assert.equal(loaded.snapshot.myUserId, ME);

  const page = watchBoard(client, location, [1, 2]);
  const withSecondCard = await page.fetchSnapshot();
  assert.equal(page.hasChanged(loaded.snapshot, withSecondCard.snapshot), false);
  const extended = page.extendLoaded?.(loaded.snapshot, withSecondCard.snapshot);
  if (extended === undefined) {
    throw new Error("a watched board extends its record");
  }

  revOfSecondCard = 2;
  const { snapshot: current } = await page.fetchSnapshot();
  assert.equal(page.hasChanged(extended, current), true);
});

test("a board with another filter is another page", () => {
  const client = {
    getAuthenticatedUserId: async (): Promise<null> => null,
    getWorkItems: async (): Promise<{ retryAfterSeconds: null; workItems: BoardWorkItem[] }> => ({
      retryAfterSeconds: null,
      workItems: [],
    }),
  };
  const pathname = "/org/project/_boards/board/t/Team/Stories";
  assert.notEqual(
    watchBoard(client, { pathname, search: "?a=1" }, []).key,
    watchBoard(client, { pathname, search: "?a=2" }, []).key,
  );
});
