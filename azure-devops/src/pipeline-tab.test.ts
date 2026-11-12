import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { createPipelineTab } from "./pipeline-tab.ts";
import { test } from "node:test";

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
      <a class="check" href="/quillfield/Ledger%20Works/_build/results?buildId=502">ledger-lint</a>
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
}

function setUp(evaluations = EVALUATIONS, timelines = TIMELINES): Setup {
  const { document } = new JSDOM(PAGE, { url: `https://dev.azure.com${PULL_REQUEST_PATH}` }).window;
  const requests: PullRequestRef[] = [];
  const tab = createPipelineTab({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async (pullRequest) => {
      requests.push(pullRequest);
      return evaluations;
    },
    getTimeline: async (_project, buildId) => timelines[buildId] ?? [],
    now: () => 0,
  });
  tab.sync(PULL_REQUEST);
  return { document, requests, tab };
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
const treeNames = (document: Document, kind: "check" | "stage" | "job" | "step"): string[] =>
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

test("a pull request gets a Pipeline tab, closed until clicked", () => {
  const { document, requests } = setUp();
  assert.equal(pipelineTab(document)?.textContent, "Pipeline");
  assert.equal(isOpen(document), false);
  assert.equal(document.querySelector(".fix-ado-pipeline-panel"), null);
  assert.deepEqual(requests, []);
});

/** The classes inside a tab, in order. */
const tabShape = (tab: Element | null): string[] =>
  [...(tab?.querySelectorAll("*") ?? [])].map((element) => element.className);

test("the tab is built like Azure DevOps's own tabs, so it lines up with them", () => {
  const { document } = setUp();
  const overview = document.querySelector("#__bolt-tab-overview");
  assert.deepEqual(tabShape(pipelineTab(document)), tabShape(overview));
});

test("the tab is added once, however often the page syncs", () => {
  const { document, tab } = setUp();
  tab.sync(PULL_REQUEST);
  tab.sync(PULL_REQUEST);
  assert.equal(document.querySelectorAll(".fix-ado-pipeline-tab").length, 1);
});

test("opening the tab shows the newest run, the stage of its first failed step, and that step's log", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  assert.equal(isOpen(document), true);
  assert.equal(pipelineTab(document)?.getAttribute("aria-selected"), "true");
  assert.equal(
    document.querySelector("#__bolt-tab-overview")?.getAttribute("aria-selected"),
    "false",
  );
  assert.deepEqual(treeNames(document, "check"), ["ledger-lint*", "ledger-ci"]);
  assert.deepEqual(treeNames(document, "stage"), ["build*", "test"]);
  assert.deepEqual(treeNames(document, "job"), ["build-job*"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=build-job&t=compile`);
});

test("a stage shows all its jobs, each with its steps, and picking a job shows its first failed step", async () => {
  const timelines = {
    ...TIMELINES,
    502: [
      ...(TIMELINES[502] ?? []),
      timelineRecord("Job", "lint-job", { order: 2, parentId: "build" }),
      timelineRecord("Task", "eslint", { order: 1, parentId: "lint-job" }),
      timelineRecord("Task", "prettier", { order: 2, parentId: "lint-job", result: "failed" }),
    ],
  };
  const { document } = setUp(EVALUATIONS, timelines);
  click(pipelineTab(document));
  await settle();
  assert.deepEqual(treeNames(document, "job"), ["build-job*", "lint-job"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile*", "eslint", "prettier"]);

  click(pickItem(document, "job", "lint-job"));
  assert.deepEqual(treeNames(document, "job"), ["build-job", "lint-job*"]);
  assert.deepEqual(treeNames(document, "step"), ["checkout", "compile", "eslint", "prettier*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=lint-job&t=prettier`);
});

test("picking a run shows only its stages and steps", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(pickItem(document, "check", "ledger-ci"));
  await settle();
  assert.deepEqual(treeNames(document, "check"), ["ledger-lint", "ledger-ci*"]);
  assert.deepEqual(treeNames(document, "stage"), ["lint-stage*"]);
  assert.deepEqual(treeNames(document, "step"), ["lint*"]);
  assert.equal(frameSource(document), `${LOG_PATH}501&view=logs&j=lint-job&t=lint`);
});

test("picking a stage shows only its steps, and picking a step shows its log", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(pickItem(document, "stage", "test"));
  assert.deepEqual(treeNames(document, "stage"), ["build", "test*"]);
  assert.deepEqual(treeNames(document, "step"), ["unit*"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=test-job&t=unit`);

  click(pickItem(document, "stage", "build"));
  click(pickItem(document, "step", "checkout"));
  assert.deepEqual(treeNames(document, "step"), ["checkout*", "compile"]);
  assert.equal(frameSource(document), `${LOG_PATH}502&view=logs&j=build-job&t=checkout`);
});

test("another tab closes the Pipeline tab and gets its selection back", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(document.querySelector("#__bolt-tab-overview"));
  assert.equal(isOpen(document), false);
  assert.equal(pipelineTab(document)?.getAttribute("aria-selected"), "false");
  const overview = document.querySelector("#__bolt-tab-overview");
  assert.equal(overview?.getAttribute("aria-selected"), "true");
  assert.ok(overview?.classList.contains("selected"));
});

test("a run link on the pull request opens that run in the tab", async () => {
  const { document } = setUp();
  click(document.querySelector(".page-content a.check"));
  await settle();
  assert.equal(isOpen(document), true);
  assert.match(frameSource(document) ?? "", /buildId=502&/u);
});

test("a run in the checks panel opens in the tab, and the panel closes", async () => {
  const { document } = setUp();
  let closeClicks = 0;
  document.querySelector("#close-checks")?.addEventListener("click", () => {
    closeClicks += 1;
  });
  click(document.querySelector(".bolt-panel a.panel-check"));
  await settle();
  assert.equal(isOpen(document), true);
  assert.deepEqual(treeNames(document, "check"), ["ledger-lint", "ledger-ci*"]);
  assert.equal(closeClicks, 1);
});

test("a pull request without runs says so", async () => {
  const { document } = setUp([]);
  click(pipelineTab(document));
  await settle();
  assert.equal(document.querySelector(".fix-ado-pipeline-frame"), null);
  assert.match(
    document.querySelector(".fix-ado-pipeline-panel")?.textContent ?? "",
    /no pipeline runs/u,
  );
});

test("syncing an open tab changes nothing, so the run is not reloaded", async () => {
  const { document, tab } = setUp();
  click(pipelineTab(document));
  await settle();
  const panel = document.querySelector(".fix-ado-pipeline-panel");
  assert.ok(panel);
  const view = document.defaultView;
  assert.ok(view);
  const changes: MutationRecord[] = [];
  const observer = new view.MutationObserver((records) => {
    changes.push(...records);
  });
  observer.observe(panel, { attributes: true, childList: true, subtree: true });
  tab.sync(PULL_REQUEST);
  await settle();
  changes.push(...observer.takeRecords());
  observer.disconnect();
  assert.deepEqual(changes, []);
});
