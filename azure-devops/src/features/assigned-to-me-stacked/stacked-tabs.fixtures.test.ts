import type { AssignedToMe } from "./assigned-card.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { showStackedTabs } from "./stacked-tabs.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);
const CONTEXT = { basePath: "/fake-org", now: Date.parse("2000-01-02T00:00:00Z") };

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

/** The ids of my pull requests with this vote, newest first. */
function idsWithMyVote({ pullRequests, reviewerId }: AssignedToMe, vote: number): string[] {
  return pullRequests
    .filter(({ reviewers }) =>
      (reviewers ?? []).some((reviewer) => reviewer.id === reviewerId && reviewer.vote === vote),
    )
    .toSorted(
      (first, second) =>
        Date.parse(second.creationDate ?? "") - Date.parse(first.creationDate ?? ""),
    )
    .map(({ pullRequestId }) => String(pullRequestId));
}

for (const page of ["pr-list-assigned-active", "pr-inbox-assigned-active-inbox"]) {
  test(`${page}: Waiting for author shows under Active`, { skip: fixtures.skip }, () => {
    const { assigned, document } = capturedPage(page);
    const card = assignedCard(document);
    const adoRows = shownLists(document).slice(1);

    showStackedTabs(document, assigned, CONTEXT);

    const waiting = idsWithMyVote(assigned, -5);
    assert.ok(waiting.length > 0, "the capture has a pull request waiting for its author");
    assert.deepEqual(shownLists(document), [
      "card · Active",
      ...adoRows,
      "card · Waiting for author",
      ...waiting,
    ]);
    assert.ok(card.classList.contains("fix-ado-assigned-stacked"));
    assert.equal(document.querySelectorAll("[id='__bolt-tab-activeMine']").length, 1);
  });
}

for (const page of ["pr-list-assigned-waiting", "pr-inbox-assigned-waiting-inbox"]) {
  test(`${page}: Active shows above Waiting for author`, { skip: fixtures.skip }, () => {
    const { assigned, document } = capturedPage(page);
    const adoRows = shownLists(document).slice(1);

    showStackedTabs(document, assigned, CONTEXT);

    assert.deepEqual(shownLists(document), [
      "card · Active",
      ...idsWithMyVote(assigned, 0),
      "card · Waiting for author",
      ...adoRows,
    ]);
  });
}

test("a built row links to its pull request and names it", { skip: fixtures.skip }, () => {
  const { assigned, document } = capturedPage("pr-list-assigned-waiting");
  showStackedTabs(document, assigned, CONTEXT);

  const [id] = idsWithMyVote(assigned, 0);
  const pullRequest = assigned.pullRequests.find(
    ({ pullRequestId }) => String(pullRequestId) === id,
  );
  const row = document.querySelector<HTMLElement>(
    `.fix-ado-assigned-card a[href$="/pullrequest/${id}"]`,
  );
  assert.ok(row !== null && pullRequest !== undefined);
  assert.equal(row.querySelector(".body-l")?.textContent, pullRequest.title);
  assert.match(row.querySelector(".secondary-text")?.textContent ?? "", new RegExp(id, "u"));
  assert.equal(row.querySelector("time")?.getAttribute("datetime"), pullRequest.creationDate);
});

test(
  "showing it again changes nothing, and null puts the card back",
  { skip: fixtures.skip },
  () => {
    const { assigned, document } = capturedPage("pr-list-assigned-active");
    const before = document.body.innerHTML;
    showStackedTabs(document, assigned, CONTEXT);
    const list = document.querySelector(".fix-ado-assigned-card");

    showStackedTabs(document, assigned, CONTEXT);
    assert.equal(document.querySelector(".fix-ado-assigned-card"), list);

    showStackedTabs(document, null, CONTEXT);
    assert.equal(document.body.innerHTML, before);
  },
);

test("a built row in the inbox names its own repository", { skip: fixtures.skip }, () => {
  const { assigned, document } = capturedPage("pr-inbox-assigned-active-inbox");
  showStackedTabs(document, assigned, CONTEXT);

  const rows = [...document.querySelectorAll(".fix-ado-assigned-card a.bolt-table-row")];
  assert.ok(rows.length > 0);
  for (const row of rows) {
    const id = Number(row.getAttribute("href")?.split("/").at(-1));
    const pullRequest = assigned.pullRequests.find(({ pullRequestId }) => pullRequestId === id);
    const repository = row.querySelector(
      ".secondary-text > span > .padding-horizontal-4:not(.monospaced-xs)",
    );
    assert.equal(repository?.textContent, pullRequest?.repository?.name);
  }
});
