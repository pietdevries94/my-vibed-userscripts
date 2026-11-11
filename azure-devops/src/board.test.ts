import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { findBoardCardIds, hasBoardChanged, isBoardLocation, watchBoard, type BoardSnapshot, type BoardWorkItem } from "./board.ts";

const ME = "my-user-id";
const snapshot = (workItems: BoardWorkItem[], myUserId: string | null = ME): BoardSnapshot =>
  ({ workItems: new Map(workItems.map((workItem) => [workItem.id, workItem])), myUserId });
const workItem = (id: number, rev: number, changedById: string | null = "someone-else"): BoardWorkItem => ({ id, rev, changedById });

test("recognises a board location", () => {
  assert.equal(isBoardLocation({ pathname: "/my-org/my-project/_boards/board/t/My%20Team/User%20Stories" }), true);
  assert.equal(isBoardLocation({ pathname: "/my-org/my-project/_backlogs/backlog/t/My%20Team/User%20Stories" }), false);
  assert.equal(isBoardLocation({ pathname: "/my-org/my-project/_git/my-repo/pullrequests" }), false);
});

test("the captured board has cards", () => {
  const { document } = new JSDOM(readFileSync(new URL("../fixtures/page-board.html", import.meta.url), "utf8")).window;
  assert.equal(document.querySelectorAll(".wit-card[data-itemid]").length, 99);
  assert.deepEqual(findBoardCardIds(document), [], "the capture masked every id to zeros");
});

test("finds the work item id of each card once", () => {
  const { document } = new JSDOM(`
    <div class="wit-card" data-itemid="101"></div><div class="wit-card" data-itemid="102"></div>
    <div class="wit-card" data-itemid="101"></div><div class="wit-card" data-itemid="new"></div><div class="wit-card"></div>
  `).window;
  assert.deepEqual(findBoardCardIds(document), [101, 102]);
});

test("an unchanged board has not changed", () => {
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)]), snapshot([workItem(1, 5)])), false);
});

test("a card changed by someone else is a change", () => {
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)]), snapshot([workItem(1, 6)])), true);
});

test("my own change is not a change", () => {
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)]), snapshot([workItem(1, 6, ME)])), false);
});

test("without knowing who I am, every change counts", () => {
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)], null), snapshot([workItem(1, 6, ME)], null)), true);
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)], null), snapshot([workItem(1, 6, null)], null)), true);
});

test("a card that was not there at load, or is gone now, is not a change", () => {
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5)]), snapshot([workItem(1, 5), workItem(2, 1)])), false);
  assert.equal(hasBoardChanged(snapshot([workItem(1, 5), workItem(2, 1)]), snapshot([workItem(1, 5)])), false);
});

test("watching a board fetches its cards and starts comparing cards that appear later", async () => {
  const requestedIds: number[][] = [];
  let revOfSecondCard = 1;
  const client = {
    async getWorkItems(ids: number[]) {
      requestedIds.push(ids);
      return { workItems: ids.map((id) => workItem(id, id === 2 ? revOfSecondCard : 5)), retryAfterSeconds: null };
    },
    getAuthenticatedUserId: async () => ME,
  };
  const location = { pathname: "/org/project/_boards/board/t/Team/Stories", search: "?filter=1" };

  const loaded = await watchBoard(client, location, [1]).fetchSnapshot();
  assert.deepEqual(requestedIds, [[1]]);
  assert.equal(loaded.snapshot.myUserId, ME);

  const page = watchBoard(client, location, [1, 2]);
  const withSecondCard = await page.fetchSnapshot();
  assert.equal(page.hasChanged(loaded.snapshot, withSecondCard.snapshot), false);
  const extended = page.extendLoaded!(loaded.snapshot, withSecondCard.snapshot);

  revOfSecondCard = 2;
  assert.equal(page.hasChanged(extended, (await page.fetchSnapshot()).snapshot), true);
});

test("a board with another filter is another page", () => {
  const client = { getWorkItems: async () => ({ workItems: [], retryAfterSeconds: null }), getAuthenticatedUserId: async () => null };
  const pathname = "/org/project/_boards/board/t/Team/Stories";
  assert.notEqual(watchBoard(client, { pathname, search: "?a=1" }, []).key, watchBoard(client, { pathname, search: "?a=2" }, []).key);
});
