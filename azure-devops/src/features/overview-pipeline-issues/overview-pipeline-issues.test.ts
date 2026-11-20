import {
  PULL_REQUEST,
  TIMELINES,
  block,
  check,
  checksAreaError,
  record,
  setUp,
  settle,
  syncAndShow,
} from "./overview-pipeline-issues.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const rows = (document: Document): string[] =>
  [...document.querySelectorAll<HTMLElement>(".fix-ado-overview-issues .fix-ado-issue")].map(
    (row) =>
      `${row.dataset.kind ?? ""}: ${row.querySelector(".fix-ado-issue-message")?.textContent ?? ""}`,
  );

test("the checks' latest runs show their errors, then warnings, above the description", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  const { document } = setup;
  assert.equal(block(document)?.nextElementSibling?.className, "repos-pr-description-card");
  const texts = (selector: string): string[] =>
    [...document.querySelectorAll(`.fix-ado-overview-issues ${selector}`)].map(
      (element) => element.textContent,
    );
  assert.deepEqual(texts(".fix-ado-overview-issues-heading"), [
    "1 error, 1 warning in the latest run",
  ]);
  assert.deepEqual(texts(".fix-ado-issue-box-title"), ["ledger-ci"]);
  assert.deepEqual(texts(".fix-ado-issue-box-details"), ["1 error, 1 warning"]);
  assert.deepEqual(rows(document), ["error: Missing semicolon", "warning: Agent is out of date"]);
});

test("each issue links to its step's log, or to its run without a step", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  const links = [
    ...setup.document.querySelectorAll(".fix-ado-overview-issues a.fix-ado-issue"),
  ].map((link) => link.getAttribute("href"));
  assert.deepEqual(links, [
    "/quillfield/Ledger%20Works/_build/results?buildId=601&view=logs&j=build-job&t=compile",
    "/quillfield/Ledger%20Works/_build/results?buildId=601",
  ]);
});

test("without warnings or errors in the checks' runs, the Overview stays as it is", async () => {
  const setup = setUp([check(602, "ledger-lint")]);
  await syncAndShow(setup);
  assert.equal(block(setup.document), null);
});

test("a block Azure DevOps removed comes back on the next sync, without a new request", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  block(setup.document)?.remove();
  const requestCount = setup.timelineRequests.length;
  setup.sync();
  assert.ok(block(setup.document));
  assert.equal(setup.timelineRequests.length, requestCount);
});

test("a running check's run is fetched again; a finished one is not", async () => {
  const setup = setUp([check(601, "ledger-ci", "running"), check(602, "ledger-lint")]);
  await syncAndShow(setup);
  assert.deepEqual(
    setup.timelineRequests.toSorted((first, second) => first - second),
    [601, 602],
  );
  setup.clock.nowMs = 30_000;
  await syncAndShow(setup);
  assert.deepEqual(
    setup.timelineRequests.toSorted((first, second) => first - second),
    [601, 601, 602],
  );
});

test("a run that finished, or a new run of a check, is fetched", async () => {
  const setup = setUp([check(601, "ledger-ci", "running")]);
  await syncAndShow(setup);
  setup.answers.evaluations = [check(601, "ledger-ci", "approved")];
  setup.clock.nowMs = 30_000;
  await syncAndShow(setup);
  setup.answers.evaluations = [check(603, "ledger-ci")];
  setup.clock.nowMs = 60_000;
  await syncAndShow(setup);
  assert.deepEqual(setup.timelineRequests, [601, 601, 603]);
  assert.equal(block(setup.document), null, "run 603 has no issues");
});

test("nothing is fetched while the page may not fetch", async () => {
  const setup = setUp();
  setup.sync(false);
  await settle();
  assert.deepEqual(setup.timelineRequests, []);
});

test("an error the checks area already shows for that run is left out, and not counted", async () => {
  const setup = setUp(undefined, checksAreaError(601, "Missing semicolon"));
  await syncAndShow(setup);
  const { document } = setup;
  assert.deepEqual(rows(document), ["warning: Agent is out of date"]);
  const details = document.querySelector(".fix-ado-overview-issues .fix-ado-issue-box-details");
  assert.equal(details?.textContent, "1 warning");
  const heading = document.querySelector(".fix-ado-overview-issues-heading");
  assert.equal(heading?.textContent, "1 warning in the latest run");
});

test("the same error of another run still shows", async () => {
  const setup = setUp(undefined, checksAreaError(599, "Missing semicolon"));
  await syncAndShow(setup);
  assert.deepEqual(rows(setup.document), [
    "error: Missing semicolon",
    "warning: Agent is out of date",
  ]);
});

test("when the checks area shows a run's only issue, the run gets no box", async () => {
  const setup = setUp(undefined, checksAreaError(601, "Missing semicolon"));
  setup.answers.timelines = {
    ...TIMELINES,
    601: [
      ...(TIMELINES[601] ?? []).filter((item) => item.type !== "Job"),
      record("Job", "build-job", { parentId: "build" }),
    ],
  };
  await syncAndShow(setup);
  assert.equal(block(setup.document), null);
});

test("the checks area showing up later takes its error out of the card", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  assert.equal(rows(setup.document).length, 2);
  setup.document
    .querySelector(".status-card")
    ?.insertAdjacentHTML("beforeend", checksAreaError(601, "Missing semicolon"));
  setup.sync();
  assert.deepEqual(rows(setup.document), ["warning: Agent is out of date"]);
});

/** The card's collapse button, its state, and whether the check boxes show. */
function cardCollapseState(document: Document): string {
  const button = document.querySelector(
    ".fix-ado-overview-issues-heading-row > .fix-ado-issue-box-collapse",
  );
  const state = button?.getAttribute("aria-expanded") === "true" ? "expanded" : "collapsed";
  const card = document.querySelector<HTMLElement>(".fix-ado-overview-issues");
  return `${state}, card ${card?.dataset.collapsed === undefined ? "open" : "collapsed"}`;
}

function clickCardCollapse(document: Document): void {
  const button = document.querySelector(
    ".fix-ado-overview-issues-heading-row > .fix-ado-issue-box-collapse",
  );
  const view = document.defaultView;
  assert.ok(button !== null && view !== null);
  button.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }));
}

test("the card starts expanded, and the button in its heading collapses and expands it", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  assert.equal(cardCollapseState(setup.document), "expanded, card open");
  clickCardCollapse(setup.document);
  assert.equal(cardCollapseState(setup.document), "collapsed, card collapsed");
  clickCardCollapse(setup.document);
  assert.equal(cardCollapseState(setup.document), "expanded, card open");
});

test("a collapsed card stays collapsed when it is drawn again, and opens for another pull request", async () => {
  const setup = setUp();
  await syncAndShow(setup);
  clickCardCollapse(setup.document);
  block(setup.document)?.remove();
  setup.sync();
  assert.equal(cardCollapseState(setup.document), "collapsed, card collapsed");

  const other = { ...PULL_REQUEST, pullRequestId: 4712 };
  setup.syncPullRequest(other);
  await settle();
  setup.syncPullRequest(other);
  assert.equal(cardCollapseState(setup.document), "expanded, card open");
});
