import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createNewActivityChips } from "./new-activity-chips.ts";
import { test } from "node:test";

test(
  "in the captured Overview, each new line gets a New chip and the new thread none",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-warnings");
    createNewActivityChips({ document }).sync();
    const rowsWithChip = [...document.querySelectorAll(".fix-ado-new-chip")].map((chip) =>
      chip.closest(".bolt-timeline-row"),
    );
    assert.equal(rowsWithChip.length, 2);
    for (const row of rowsWithChip) {
      assert.ok(row?.querySelector(".activity-card-subtle"));
    }
  },
);
