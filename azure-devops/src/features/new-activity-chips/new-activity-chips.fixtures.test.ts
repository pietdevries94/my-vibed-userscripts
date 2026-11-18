import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createNewActivityChips } from "./new-activity-chips.ts";
import { createVisitStore } from "./visit-store.ts";
import { test } from "node:test";

const PULL_REQUEST = "example.test/p/r/7";

/** A visit store that holds one visit at `visitedAt`. */
function visitsAt(visitedAt: number | null): ReturnType<typeof createVisitStore> {
  const values = new Map<string, unknown>();
  const visits = createVisitStore({
    keys: () => [...values.keys()],
    load: (key) => values.get(key) ?? null,
    remove: (key) => {
      values.delete(key);
    },
    save: (key, saved) => {
      values.set(key, saved);
    },
  });
  if (visitedAt !== null) {
    visits.save(PULL_REQUEST, visitedAt);
  }
  return visits;
}

test(
  "in the captured Overview, after a visit before everything, every push and line gets a chip after its time",
  { skip: fixtures.skipWithout("pr-detail-script-on.html") },
  () => {
    // The capture scrubs times in page order, not in the order they happened, so this checks
    // where the chips go. Which rows count as new is in the unit tests. The capture was made
    // with the script on: its push rows hold the script's toggles, which this check ignores.
    const { document } = loadCapturedPullRequest("pr-detail-script-on");
    createNewActivityChips({ document, now: () => 0, visits: visitsAt(0) }).sync(PULL_REQUEST);
    const rows = [...document.querySelectorAll(".bolt-timeline-row")].filter(
      (row) => row.querySelector(".iteration-card-header, .activity-card-subtle") !== null,
    );
    assert.ok(rows.some((row) => row.querySelector(".iteration-card-header") !== null));
    for (const row of rows) {
      const chips = row.querySelectorAll(".fix-ado-new-chip");
      assert.equal(chips.length, 1);
      assert.equal(row.querySelector("time")?.parentElement?.nextElementSibling, chips[0]);
    }
  },
);

test(
  "in the captured Overview without a saved visit, each line Azure DevOps flags gets a chip and the thread none",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-warnings");
    createNewActivityChips({ document, now: () => 0, visits: visitsAt(null) }).sync(PULL_REQUEST);
    const rowsWithChip = [...document.querySelectorAll(".fix-ado-new-chip")].map((chip) =>
      chip.closest(".bolt-timeline-row"),
    );
    assert.equal(rowsWithChip.length, 2);
    for (const row of rowsWithChip) {
      assert.ok(row?.querySelector(".activity-card-subtle"));
    }
  },
);
