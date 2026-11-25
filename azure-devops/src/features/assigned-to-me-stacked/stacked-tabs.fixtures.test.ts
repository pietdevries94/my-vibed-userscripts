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

/** The card's lists in order: each title, then the ids of the pull requests under it. */
function shownLists(card: HTMLElement): string[] {
  return [...card.querySelectorAll(".fix-ado-assigned-title, a.bolt-table-row")].map((node) =>
    node.classList.contains("fix-ado-assigned-title")
      ? `title ${node.firstChild?.textContent}`
      : (node.getAttribute("href")?.split("/").at(-1) ?? ""),
  );
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
    const adoRows = shownLists(card);

    showStackedTabs(document, assigned, CONTEXT);

    const waiting = idsWithMyVote(assigned, -5);
    assert.ok(waiting.length > 0, "the capture has a pull request waiting for its author");
    assert.deepEqual(shownLists(card), [
      "title Active",
      ...adoRows,
      "title Waiting for author",
      ...waiting,
    ]);
    assert.ok(card.classList.contains("fix-ado-assigned-stacked"));
  });
}

for (const page of ["pr-list-assigned-waiting", "pr-inbox-assigned-waiting-inbox"]) {
  test(`${page}: Active shows above Waiting for author`, { skip: fixtures.skip }, () => {
    const { assigned, document } = capturedPage(page);
    const card = assignedCard(document);
    const adoRows = shownLists(card);

    showStackedTabs(document, assigned, CONTEXT);

    assert.deepEqual(shownLists(card), [
      "title Active",
      ...idsWithMyVote(assigned, 0),
      "title Waiting for author",
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
    `.fix-ado-assigned-list a[href$="/pullrequest/${id}"]`,
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
    const card = assignedCard(document);
    const before = card.innerHTML;
    showStackedTabs(document, assigned, CONTEXT);
    const list = card.querySelector(".fix-ado-assigned-list");

    showStackedTabs(document, assigned, CONTEXT);
    assert.equal(card.querySelector(".fix-ado-assigned-list"), list);

    showStackedTabs(document, null, CONTEXT);
    assert.equal(card.innerHTML, before);
  },
);

test("a built row in the inbox names its own repository", { skip: fixtures.skip }, () => {
  const { assigned, document } = capturedPage("pr-inbox-assigned-active-inbox");
  showStackedTabs(document, assigned, CONTEXT);

  const rows = [...document.querySelectorAll(".fix-ado-assigned-list a.bolt-table-row")];
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
