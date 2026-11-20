import { BUILD_POLICY_TYPE_ID } from "../../pipeline/pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "../../pipeline/pipeline-status.ts";
import type { PullRequestBuild } from "../../pipeline/pipeline-checks.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { RunTab } from "./run-tab-store.ts";
import assert from "node:assert/strict";
import { createPullRequestRunTabs } from "./pull-request-run-tabs.ts";
import { test } from "node:test";

const PULL_REQUEST: PullRequestRef = {
  project: "Ledger Works",
  pullRequestId: 4711,
  repository: "ledger-api",
};

const PAGE = `<!doctype html><body>
  <div class="repos-pr-details-page">
    <div class="repos-pr-header">Fix the totals</div>
    <div class="repos-pr-details-page-tabbar"><div role="tablist">
      <a class="bolt-tab selected" role="tab" aria-selected="true" id="__bolt-tab-overview"><span class="bolt-tab-text">Overview</span></a>
      <a class="bolt-tab" role="tab" aria-selected="false" id="__bolt-tab-files"><span class="bolt-tab-text">Files</span></a>
      <a class="bolt-tab fix-ado-pipeline-tab" role="tab" aria-selected="false" data-fix-ado-own-tab=""><span class="bolt-tab-text">Pipeline</span></a>
    </div></div>
    <div class="page-content">Overview</div>
  </div>
</body>`;

function check(pipelineId: number, name: string, buildId: number | null): PolicyEvaluation {
  return {
    configuration: {
      isBlocking: true,
      settings: { buildDefinitionId: pipelineId },
      type: { id: BUILD_POLICY_TYPE_ID },
    },
    context: buildId === null ? null : { buildDefinitionName: name, buildId },
    status: "approved",
  };
}

const COVERAGE: RunTab = {
  label: "Code Coverage",
  pipelineId: 3,
  pipelineName: "ledger-ci",
  view: "codecoverage-tab",
};
const DEPLOYMENTS: RunTab = {
  label: "Deployments",
  pipelineId: 7,
  pipelineName: "ledger-deploy",
  view: "quillfield.deploys.deploy-tab",
};

interface Setup {
  document: Document;
  sync: () => void;
  clock: { nowMs: number };
  answers: { builds: PullRequestBuild[]; tabs: RunTab[] };
  requestCount: () => number;
}

function setUp(tabs = [COVERAGE, DEPLOYMENTS]): Setup {
  const { document } = new JSDOM(PAGE, {
    url: "https://dev.azure.com/quillfield/Ledger%20Works/_git/ledger-api/pullrequest/4711",
  }).window;
  const clock = { nowMs: 0 };
  const answers = { builds: [] as PullRequestBuild[], tabs };
  let requests = 0;
  const runTabs = createPullRequestRunTabs({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async () => {
      requests += 1;
      return [check(3, "ledger-ci", 502), check(7, "ledger-deploy", null)];
    },
    getPullRequestBuilds: async () => answers.builds,
    loadRunTabs: () => answers.tabs,
    now: () => clock.nowMs,
  });
  return {
    answers,
    clock,
    document,
    requestCount: () => requests,
    sync: () => {
      runTabs.sync(PULL_REQUEST, true);
    },
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

async function loaded(tabs?: RunTab[]): Promise<Setup> {
  const setup = setUp(tabs);
  setup.sync();
  await settle();
  setup.sync();
  return setup;
}

function click(element: Element | null | undefined): void {
  assert.ok(element);
  const view = element.ownerDocument.defaultView;
  assert.ok(view);
  element.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }));
}

const tabNames = (document: Document): string[] =>
  [...document.querySelectorAll("[role=tablist] [role=tab]")].map(
    (tab) =>
      `${tab.textContent.trim()}${tab.getAttribute("aria-selected") === "true" ? "*" : ""}${tab.getAttribute("aria-disabled") === "true" ? " (disabled)" : ""}`,
  );
const runTab = (document: Document, name: string): Element | undefined =>
  [...document.querySelectorAll(".fix-ado-run-tab")].find((tab) => tab.textContent.trim() === name);
const frameSource = (document: Document): string | null =>
  document.querySelector(".fix-ado-run-tab-frame")?.getAttribute("src") ?? null;
const isOpen = (document: Document): boolean =>
  document.querySelector<HTMLElement>(".repos-pr-details-page")?.dataset.fixAdoRunTabOpen !==
  undefined;

test("each turned-on tab of a check's pipeline is a tab after Pipeline; one without a run is disabled", async () => {
  const { document } = await loaded();
  assert.deepEqual(tabNames(document), [
    "Overview*",
    "Files",
    "Pipeline",
    "Code Coverage",
    "Deployments (disabled)",
  ]);
  assert.equal(
    runTab(document, "Deployments")?.getAttribute("title"),
    "No run of ledger-deploy yet",
  );
});

test("picking a tab shows that tab of the pipeline's latest run, in place of the page", async () => {
  const { document } = await loaded();
  click(runTab(document, "Code Coverage"));
  assert.deepEqual(tabNames(document).slice(0, 4), [
    "Overview",
    "Files",
    "Pipeline",
    "Code Coverage*",
  ]);
  assert.equal(isOpen(document), true);
  assert.equal(
    frameSource(document),
    "/quillfield/Ledger%20Works/_build/results?buildId=502&view=codecoverage-tab",
  );
});

test("a disabled tab does nothing on a click", async () => {
  const { document } = await loaded();
  click(runTab(document, "Deployments"));
  assert.equal(isOpen(document), false);
  assert.deepEqual(tabNames(document)[0], "Overview*");
});

test("another tab closes it and is selected", async () => {
  const { document } = await loaded();
  click(runTab(document, "Code Coverage"));
  click(document.querySelector("#__bolt-tab-overview"));
  assert.equal(isOpen(document), false);
  assert.equal(document.querySelector(".fix-ado-run-tab-panel"), null);
  assert.deepEqual(tabNames(document).slice(0, 4), [
    "Overview*",
    "Files",
    "Pipeline",
    "Code Coverage",
  ]);
});

test("a run without the tab shows a note in place of the frame", async () => {
  const { document, sync } = await loaded();
  click(runTab(document, "Code Coverage"));
  const frame = document.querySelector<HTMLIFrameElement>(".fix-ado-run-tab-frame");
  assert.ok(frame);
  frame.dataset.fixAdoMissingTab = "codecoverage-tab";
  sync();
  assert.equal(
    document.querySelector(".fix-ado-run-tab-missing")?.textContent,
    "This run has no Code Coverage tab.",
  );
  assert.equal(frame.hidden, true);
});

test("a newer run of the pipeline moves the open tab to it on the next refresh", async () => {
  const setup = await loaded();
  click(runTab(setup.document, "Code Coverage"));
  setup.answers.builds = [
    { buildNumber: "20310402.9", definition: { id: 3 }, id: 509, status: "inProgress" },
  ];
  setup.clock.nowMs = 30_000;
  setup.sync();
  await settle();
  setup.sync();
  assert.match(frameSource(setup.document) ?? "", /buildId=509&/u);
});

test("without turned-on tabs, nothing is fetched and no tab is added", async () => {
  const { document, requestCount } = await loaded([]);
  assert.equal(requestCount(), 0);
  assert.equal(document.querySelectorAll(".fix-ado-run-tab").length, 0);
});

test("a tab turned off goes away", async () => {
  const setup = await loaded();
  setup.answers.tabs = [COVERAGE];
  setup.sync();
  assert.deepEqual(tabNames(setup.document).slice(3), ["Code Coverage"]);
});
