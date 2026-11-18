import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createUnreadComments } from "./unread-comments.ts";
import { test } from "node:test";

test(
  "the captured thread with two unread comments is one group, and Go to first unread is on",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-warnings");
    createUnreadComments({ document }).sync();
    const marks = [...document.querySelectorAll<HTMLElement>("[data-fix-ado-unread]")].map(
      (comment) => comment.dataset.fixAdoUnread,
    );
    assert.deepEqual(marks, ["first", "last"]);
    assert.equal(
      document.querySelector<HTMLButtonElement>(".fix-ado-first-unread")?.disabled,
      false,
    );
  },
);

test(
  "in the captured wide Overview, new threads Azure DevOps has not rendered yet turn Go to first unread on",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail-wide");
    createUnreadComments({ document }).sync();
    assert.equal(
      document.querySelector<HTMLButtonElement>(".fix-ado-first-unread")?.disabled,
      false,
    );
    assert.equal(document.querySelectorAll("[data-fix-ado-unread]").length, 0);
  },
);
