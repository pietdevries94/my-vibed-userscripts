// The Overview test harness: a pull request page, its checks and run timelines, and the
// feature on it with a clock. Dev file only.
import { BUILD_POLICY_TYPE_ID } from "../../pipeline/pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { TimelineRecord } from "../../pipeline/pipeline-timeline.ts";
import assert from "node:assert/strict";
import { createOverviewPipelineIssues } from "./overview-pipeline-issues.ts";

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
  /** Syncs the page as showing this pull request. */
  syncPullRequest: (pullRequest: PullRequestRef) => void;
  timelineRequests: number[];
  clock: { nowMs: number };
  answers: { evaluations: PolicyEvaluation[]; timelines: Record<number, TimelineRecord[]> };
}

/** Azure DevOps's checks area, with a run's error as it shows a failed check. */
function checksAreaError(buildId: number, message: string): string {
  return `<a class="bolt-table-link" href="/quillfield/Ledger%20Works/_build/results?buildId=${buildId}">
    <div class="flex-row monospaced-m dark-build-output"><div class="line-number">12</div><div class="error-text word-break">${message}</div></div>
  </a>`;
}

function setUp(
  evaluations = [check(601, "ledger-ci"), check(602, "ledger-lint")],
  checksArea = "",
): Setup {
  const page = PAGE.replace(
    '<div class="status-card">Checks</div>',
    `<div class="status-card">${checksArea}</div>`,
  );
  const { document } = new JSDOM(page, {
    url: "https://dev.azure.com/quillfield/Ledger%20Works/_git/ledger-api/pullrequest/4711",
  }).window;
  const clock = { nowMs: 0 };
  const timelineRequests: number[] = [];
  const answers = { evaluations, timelines: TIMELINES };
  const overview = createOverviewPipelineIssues({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async (pullRequest) => {
      assert.equal(pullRequest.project, PULL_REQUEST.project);
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
    syncPullRequest: (pullRequest) => {
      overview.sync(pullRequest, true);
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

export type { Setup };
export {
  PULL_REQUEST,
  TIMELINES,
  block,
  check,
  checksAreaError,
  record,
  setUp,
  settle,
  syncAndShow,
};
