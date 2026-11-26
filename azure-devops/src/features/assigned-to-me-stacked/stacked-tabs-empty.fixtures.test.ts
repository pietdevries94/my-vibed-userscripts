import {
  CONTEXT,
  assignedCard,
  capturedPage,
  idsWithMyVote,
  reviewedIds,
  shownLists,
} from "./stacked-tabs.test-page.ts";
import assert from "node:assert/strict";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { showStackedTabs } from "./stacked-tabs.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

test(
  "the Reviewed card shows, empty, while Azure DevOps has no Reviewed tab",
  { skip: fixtures.skip },
  () => {
    const { assigned, document } = capturedPage("pr-inbox-assigned-active-empty");
    showStackedTabs(
      document,
      {
        ...assigned,
        pullRequests: assigned.pullRequests.filter(
          ({ pullRequestId }) => !reviewedIds(assigned).includes(String(pullRequestId)),
        ),
      },
      CONTEXT,
    );
    const reviewed = [...document.querySelectorAll(".fix-ado-assigned-card")].at(-1);
    assert.equal(
      reviewed?.querySelector(".fix-ado-assigned-tab-name")?.firstChild?.textContent,
      "· Reviewed",
    );
    assert.equal(reviewed?.querySelectorAll("a.bolt-table-row").length, 0);
  },
);

test(
  "with Active empty, the other tabs build their rows from a row of another card",
  { skip: fixtures.skip },
  () => {
    const { assigned, document } = capturedPage("pr-inbox-assigned-active-inbox");
    for (const row of assignedCard(document).querySelectorAll("a.bolt-table-row")) {
      row.remove();
    }

    showStackedTabs(document, assigned, CONTEXT);

    assert.deepEqual(shownLists(document), [
      "card · Active",
      "card · Waiting for author",
      ...idsWithMyVote(assigned, -5),
      "card · Reviewed",
      ...reviewedIds(assigned),
    ]);
  },
);
