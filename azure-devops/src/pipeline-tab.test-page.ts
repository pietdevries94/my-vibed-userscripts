// The pull request page and helpers that the Pipeline tab tests share. Test code only.
import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestBuild } from "./pipeline-checks.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { createPipelineTab } from "./pipeline-tab.ts";

const PULL_REQUEST: PullRequestRef = {
  project: "Ledger Works",
  pullRequestId: 4711,
  repository: "ledger-api",
};
const PULL_REQUEST_PATH = "/quillfield/Ledger%20Works/_git/ledger-api/pullrequest/4711";

const PAGE = `<!doctype html><body>
  <div class="repos-pr-details-page">
    <div class="repos-pr-header">Fix the totals</div>
    <div class="repos-pr-details-page-tabbar">
      <div role="tablist">
        <a class="bolt-tab selected" role="tab" aria-selected="true" id="__bolt-tab-overview"><span class="bolt-tab-inner-container"><span class="bolt-tab-text">Overview</span></span></a>
        <a class="bolt-tab" role="tab" aria-selected="false" id="__bolt-tab-files"><span class="bolt-tab-inner-container"><span class="bolt-tab-text">Files</span></span></a>
      </div>
    </div>
    <div class="page-content">
      <a class="check" href="/quillfield/Ledger%20Works/_build/results?buildId=502">ledger-lint <button class="requeue" type="button"><span>Re-queue</span></button></a>
    </div>
  </div>
  <div class="bolt-portal"><div class="bolt-panel" role="dialog">
    <div class="bolt-panel-header"><button id="close-checks"><span class="ms-Icon--Clear"></span></button></div>
    <a class="panel-check" href="/quillfield/Ledger%20Works/_build/results?buildId=501">ledger-ci</a>
  </div></div>
</body>`;

function buildEvaluation(buildId: number, name: string, startedAt: string): PolicyEvaluation {
  return {
    configuration: { isBlocking: true, type: { id: BUILD_POLICY_TYPE_ID } },
    context: { buildDefinitionName: name, buildId, buildStartedUtc: startedAt },
    evaluationId: `evaluation-${buildId}`,
    status: "approved",
  };
}

const EVALUATIONS = [
  buildEvaluation(501, "ledger-ci", "2031-04-02T09:00:00Z"),
  buildEvaluation(502, "ledger-lint", "2031-04-02T10:00:00Z"),
];

function timelineRecord(
  type: string,
  id: string,
  extra: Partial<TimelineRecord> = {},
): TimelineRecord {
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

/** Run 502: a build stage whose compile step failed, then a test stage. Run 501: one lint step. */
const TIMELINES: Record<number, TimelineRecord[]> = {
  501: [
    timelineRecord("Stage", "lint-stage"),
    timelineRecord("Job", "lint-job", { parentId: "lint-stage" }),
    timelineRecord("Task", "lint", { parentId: "lint-job" }),
  ],
  502: [
    timelineRecord("Stage", "build", { order: 1, result: "failed" }),
    timelineRecord("Stage", "test", { order: 2 }),
    timelineRecord("Job", "build-job", { parentId: "build" }),
    timelineRecord("Job", "test-job", { parentId: "test" }),
    timelineRecord("Task", "checkout", { order: 1, parentId: "build-job" }),
    timelineRecord("Task", "compile", { order: 2, parentId: "build-job", result: "failed" }),
    timelineRecord("Task", "unit", { parentId: "test-job" }),
  ],
};

interface Setup {
  document: Document;
  tab: ReturnType<typeof createPipelineTab>;
  requests: PullRequestRef[];
  /** The evaluation ids of the build checks the tab re-queued. */
  requeued: string[];
}

/** The run list's answer: none by default, so the checks' runs are the list. */
type RunListAnswer = () => Promise<PullRequestBuild[]>;

/** Azure DevOps's answer to a re-queue. Each setUp makes it accept; a test may change it. */
const requeue = { answer: async (): Promise<unknown> => null };

/** The tab's clock. Each setUp starts it at 0; a test moves it to let refreshes come due. */
const clock = { nowMs: 0 };

function setUp(
  evaluations = EVALUATIONS,
  timelines = TIMELINES,
  runList: RunListAnswer = async () => [],
): Setup {
  clock.nowMs = 0;
  requeue.answer = async (): Promise<unknown> => null;
  const { document } = new JSDOM(PAGE, { url: `https://dev.azure.com${PULL_REQUEST_PATH}` }).window;
  const requests: PullRequestRef[] = [];
  const requeued: string[] = [];
  const tab = createPipelineTab({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async (pullRequest) => {
      requests.push(pullRequest);
      return evaluations;
    },
    getPullRequestBuilds: runList,
    getTimeline: async (_project, buildId) => timelines[buildId] ?? [],
    now: () => clock.nowMs,
    requeueCheck: async (pullRequest, evaluationId) => {
      assert.deepEqual(pullRequest, PULL_REQUEST);
      requeued.push(evaluationId);
      await requeue.answer();
    },
  });
  tab.sync(PULL_REQUEST);
  return { document, requests, requeued, tab };
}

function click(element: Element | null): void {
  assert.ok(element);
  const view = element.ownerDocument.defaultView;
  assert.ok(view);
  element.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** Lets the fetched checks, and then the shown run's timeline, come in. */
async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each round lets the next answer in
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

const pipelineTab = (document: Document): Element | null =>
  document.querySelector("[role=tablist] .fix-ado-pipeline-tab");
/** The names in the tree, in order, with a * on the current ones. */
const treeNames = (document: Document, kind: "run" | "stage" | "job" | "step"): string[] =>
  [...document.querySelectorAll(`.fix-ado-pipeline-${kind}`)].map(
    (item) =>
      `${item.querySelector(".fix-ado-pipeline-item-name")?.textContent ?? ""}${item.getAttribute("aria-current") === "true" ? "*" : ""}`,
  );
const LOG_PATH = "/quillfield/Ledger%20Works/_build/results?buildId=";
const pickItem = (document: Document, kind: string, name: string): Element | null =>
  [...document.querySelectorAll(`.fix-ado-pipeline-${kind}`)].find(
    (item) => item.querySelector(".fix-ado-pipeline-item-name")?.textContent === name,
  ) ?? null;
const frameSource = (document: Document): string | null =>
  document.querySelector(".fix-ado-pipeline-frame")?.getAttribute("src") ?? null;
const isOpen = (document: Document): boolean =>
  document.querySelector<HTMLElement>(".repos-pr-details-page")?.dataset.fixAdoPipelineTabOpen !==
  undefined;

export type { Setup };
export {
  EVALUATIONS,
  LOG_PATH,
  PULL_REQUEST,
  TIMELINES,
  click,
  clock,
  frameSource,
  isOpen,
  pickItem,
  pipelineTab,
  requeue,
  settle,
  setUp,
  timelineRecord,
  treeNames,
};
