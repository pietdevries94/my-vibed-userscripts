// The captured pages the stacked tabs' fixture tests run on, and what they read back. Dev only.
import type { AssignedToMe } from "./assigned-card.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";

const fixtures = scriptFixtures(import.meta.dirname);
const CONTEXT = {
  basePath: "/fake-org",
  folding: { foldedTabIds: new Set<string>(), onToggle: (): void => undefined },
  now: Date.parse("2000-01-02T00:00:00Z"),
};

function capturedPage(page: string): { document: Document; assigned: AssignedToMe } {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const root = buildFixtureDom(document, fixtures.read(`${page}.html`));
  assert.ok(root !== null, "the fixture has a root element");
  document.body.append(root);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  const { data } = JSON.parse(fixtures.read(`${page}.json`)) as {
    data: {
      assignedToMe: { authenticatedUserId: string; pullRequests: AssignedToMe["pullRequests"] };
    };
  };
  const { authenticatedUserId, pullRequests } = data.assignedToMe;
  return { assigned: { pullRequests, reviewerId: authenticatedUserId }, document };
}

function assignedCard(document: Document): HTMLElement {
  const card = document
    .querySelector("#__bolt-tab-activeMine")
    ?.closest<HTMLElement>(".repos-pr-section-card");
  assert.ok(card, "the Assigned to me card");
  return card;
}

/** The Assigned to me cards in order: each card's tab, then the ids of its pull requests. */
function shownLists(document: Document): string[] {
  const cards = document.querySelectorAll("#__bolt-tab-activeMine, .fix-ado-assigned-card");
  return [...cards].flatMap((found) => {
    const card = found.closest(".repos-pr-section-card") ?? found;
    const tab =
      card.querySelector(".fix-ado-assigned-tab-name")?.firstChild ??
      card.querySelector('[role="tab"][aria-selected="true"] .bolt-tab-text');
    const rows = [...card.querySelectorAll("a.bolt-table-row")].map(
      (row) => row.getAttribute("href")?.split("/").at(-1) ?? "",
    );
    return Array.of(`card ${tab?.textContent}`, ...rows);
  });
}

/** A vote on the Reviewed card: any but none and Waiting for author. */
const isReviewed = (vote: number): boolean => vote !== 0 && vote !== -5;

/** The ids of the pull requests the Reviewed card lists, newest first. */
const reviewedIds = (assigned: AssignedToMe): string[] => idsWithMyVote(assigned, isReviewed);

/** The ids of my pull requests with this vote, or a vote it accepts, newest first. */
function idsWithMyVote(
  { pullRequests, reviewerId }: AssignedToMe,
  vote: number | ((vote: number) => boolean),
): string[] {
  const accepts = typeof vote === "number" ? (given: number): boolean => given === vote : vote;
  return pullRequests
    .filter(({ reviewers }) =>
      (reviewers ?? []).some(
        (reviewer) => reviewer.id === reviewerId && accepts(reviewer.vote ?? 0),
      ),
    )
    .toSorted(
      (first, second) =>
        Date.parse(second.creationDate ?? "") - Date.parse(first.creationDate ?? ""),
    )
    .map(({ pullRequestId }) => String(pullRequestId));
}

export { CONTEXT, assignedCard, capturedPage, idsWithMyVote, reviewedIds, shownLists };
