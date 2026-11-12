import type { BoardSnapshot, BoardWorkItem } from "./board.ts";
import { findBoardCardIds, hasBoardChanged } from "./board.ts";
import { JSDOM } from "jsdom";
import type { WorkItemUpdate } from "./days-in-column.ts";
import assert from "node:assert/strict";
import { columnEnteredAt } from "./days-in-column.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedBoard {
  data: {
    myUserId: string | null;
    workItems: BoardWorkItem[];
    /** Added with the days in column feature. Older captures lack it. */
    updatesByWorkItemId?: Record<string, WorkItemUpdate[]>;
  };
}

function capturedBoard(): CapturedBoard {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  return JSON.parse(fixtures.read("board.json")) as CapturedBoard;
}

function capturedSnapshot(): BoardSnapshot {
  const { data } = capturedBoard();
  return {
    myUserId: data.myUserId,
    workItems: new Map(data.workItems.map((workItem) => [workItem.id, workItem])),
  };
}

/** The captured snapshot, with one work item changed by `changedById`. */
function withOneChange(snapshot: BoardSnapshot, changedById: string): BoardSnapshot {
  const [first] = snapshot.workItems.values();
  assert.ok(first !== undefined);
  const workItems = new Map([
    ...snapshot.workItems,
    [first.id, { ...first, changedById, rev: first.rev + 1 }],
  ]);
  return { ...snapshot, workItems };
}

test(
  "finds every card of the captured board, the same ones as its work items",
  {
    skip: fixtures.skip,
  },
  () => {
    const { document } = new JSDOM(fixtures.read("board.html")).window;
    const cardIds = findBoardCardIds(document);
    assert.equal(cardIds.length, 100);
    assert.deepEqual(
      cardIds.toSorted((left, right) => left - right),
      capturedBoard()
        .data.workItems.map(({ id }) => id)
        .toSorted((left, right) => left - right),
    );
  },
);

test("the captured board has not changed against itself", { skip: fixtures.skip }, () => {
  assert.equal(hasBoardChanged(capturedSnapshot(), capturedSnapshot()), false);
});

test("a card someone else changed counts as a change", { skip: fixtures.skip }, () => {
  const loaded = capturedSnapshot();
  assert.equal(hasBoardChanged(loaded, withOneChange(loaded, "someone-else")), true);
});

test("a card the signed-in user changed does not count", { skip: fixtures.skip }, () => {
  const loaded = capturedSnapshot();
  assert.ok(loaded.myUserId !== null, "the capture knows who is signed in");
  assert.equal(hasBoardChanged(loaded, withOneChange(loaded, loaded.myUserId)), false);
});

test("each captured card has a date it entered its column", { skip: fixtures.skip }, (context) => {
  const { updatesByWorkItemId } = capturedBoard().data;
  if (updatesByWorkItemId === undefined) {
    context.skip("the board capture predates the days in column feature");
    return;
  }
  const cards = Object.values(updatesByWorkItemId);
  assert.ok(cards.length > 0);
  for (const updates of cards) {
    const enteredAt = columnEnteredAt(updates);
    assert.ok(enteredAt !== null, "a board column change in the updates");
    assert.ok(!Number.isNaN(Date.parse(enteredAt)));
  }
});
