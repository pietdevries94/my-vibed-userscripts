import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { createOverviewPipelineIssues } from "./overview-pipeline-issues.ts";
import { test } from "node:test";

const PULL_REQUEST: PullRequestRef = {
  project: "Ledger Works",
  pullRequestId: 4711,
  repository: "ledger-api",
};

const PAGE = `<!doctype html><body>
  <div class="repos-pr-details-page">
    <div class="repos-overview">
      <div class="status-card">Checks</div>
      <div class="repos-pr-description-card">Description</div>
    </div>
  </div>
</body>`;

function check(buildId: number, name: string, status = "approved"): PolicyEvaluation {
  return {
    configuration: { isBlocking: true, type: { id: BUILD_POLICY_TYPE_ID } },
    context: {
      buildDefinitionName: name,
      buildId,
      buildStartedUtc: `2031-04-02T0${buildId % 10}:00:00Z`,
    },
    evaluationId: `evaluation-${buildId}`,
    status,
  };
}

function record(type: string, id: string, extra: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    id,
    name: id,
    order: 1,
    parentId: null,
    result: "succeeded",
    state: "completed",
    type,
    ...extra,
  };
}

/** Run 601 of ledger-ci warns on its build job and fails compile; run 602 of ledger-lint is clean. */
const TIMELINES: Record<number, TimelineRecord[]> = {
  601: [
    record("Stage", "build"),
    record("Job", "build-job", {
      issues: [{ message: "Agent is out of date", type: "warning" }],
      parentId: "build",
      warningCount: 1,
    }),
    record("Task", "compile", {
      errorCount: 1,
      issues: [{ message: "Missing semicolon", type: "error" }],
      parentId: "build-job",
    }),
  ],
  602: [record("Stage", "lint"), record("Job", "lint-job", { parentId: "lint" })],
};

interface Setup {
  document: Document;
  sync: (canFetch?: boolean) => void;
  timelineRequests: number[];
  clock: { nowMs: number };
  answers: { evaluations: PolicyEvaluation[]; timelines: Record<number, TimelineRecord[]> };
}

function setUp(evaluations = [check(601, "ledger-ci"), check(602, "ledger-lint")]): Setup {
  const { document } = new JSDOM(PAGE, {
    url: "https://dev.azure.com/quillfield/Ledger%20Works/_git/ledger-api/pullrequest/4711",
  }).window;
  const clock = { nowMs: 0 };
  const timelineRequests: number[] = [];
  const answers = { evaluations, timelines: TIMELINES };
  const overview = createOverviewPipelineIssues({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async (pullRequest) => {
      assert.deepEqual(pullRequest, PULL_REQUEST);
      return answers.evaluations;
    },
    getTimeline: async (project, buildId) => {
      assert.equal(project, PULL_REQUEST.project);
      timelineRequests.push(buildId);
      return answers.timelines[buildId] ?? [];
    },
    now: () => clock.nowMs,
  });
  return {
    answers,
    clock,
    document,
    sync: (canFetch = true) => {
      overview.sync(PULL_REQUEST, canFetch);
    },
    timelineRequests,
  };
}

async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each round lets the next answer in
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

/** Loads, then shows what came in, as main.ts's next sync does. */
async function syncAndShow(setup: Setup): Promise<void> {
  setup.sync();
  await settle();
  setup.sync();
}

const block = (document: Document): Element | null =>
  document.querySelector(".fix-ado-overview-issues");

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
