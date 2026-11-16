import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createJoinedReviewerLines } from "./joined-reviewer-lines.ts";
import { test } from "node:test";

/** Per row of the captured feed: "line" with its avatar count, "hidden", or "-". */
function joinedRows(page: string): string[] {
  const { document } = loadCapturedPullRequest(page);
  const { sync } = createJoinedReviewerLines({ document });
  sync();
  sync();
  return [
    ...document.querySelectorAll<HTMLElement>(".activity-feed-list > tbody > .bolt-timeline-row"),
  ].map((row) => {
    const joined = row.querySelectorAll(".fix-ado-joined-line");
    assert.ok(joined.length <= 1);
    const avatars = joined[0]?.querySelectorAll(".bolt-coin").length;
    return row.dataset.fixAdoJoined === "line"
      ? `line:${avatars}`
      : (row.dataset.fixAdoJoined ?? "-");
  });
}

test(
  "the captured Overview joins its two runs of lines about reviewers, and no other line",
  { skip: fixtures.skip },
  () => {
    assert.deepEqual(joinedRows("pr-detail-reviewers-add"), [
      "-",
      "line:4",
      "hidden",
      "hidden",
      "-",
      "-",
      "-",
      "line:3",
      "hidden",
      "-",
    ]);
  },
);
