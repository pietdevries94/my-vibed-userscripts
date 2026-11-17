import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createResolvedThreadChips } from "./resolved-thread-chips.ts";
import { test } from "node:test";

/** The captured Overview with two active threads, and the status labels the feature reads. */
function capturedThreads(): { document: Document; statuses: Element[] } {
  const { document } = loadCapturedPullRequest("pr-detail-duplicate-error");
  const statuses = [
    ...document.querySelectorAll(
      ".repos-discussion-thread .repos-discussion-comment-header .bolt-dropdown-expandable-button-label",
    ),
  ];
  return { document, statuses };
}

test("the captured active threads get an Unresolved chip", { skip: fixtures.skip }, () => {
  const { document, statuses } = capturedThreads();
  assert.deepEqual(
    statuses.map((status) => status.textContent),
    ["Active", "Active"],
  );
  createResolvedThreadChips({ document }).sync();
  assert.deepEqual(
    [...document.querySelectorAll(".fix-ado-thread-chip")].map((chip) => chip.textContent),
    ["Unresolved", "Unresolved"],
  );
});

test(
  "a captured thread whose status reads Resolved gets a chip in its first comment's header",
  { skip: fixtures.skip },
  () => {
    const { document, statuses } = capturedThreads();
    const [status] = statuses;
    assert.ok(status !== undefined);
    status.textContent = "Resolved";
    createResolvedThreadChips({ document }).sync();

    const chips = document.querySelectorAll(".fix-ado-resolved-chip");
    assert.equal(document.querySelectorAll(".fix-ado-unresolved-chip").length, 1);
    assert.equal(chips.length, 1);
    const [chip] = chips;
    const header = status.closest(".repos-discussion-comment-header");
    assert.ok(chip?.parentElement?.parentElement?.parentElement === header);
    assert.ok(chip.previousElementSibling?.querySelector("time") !== null);
  },
);
