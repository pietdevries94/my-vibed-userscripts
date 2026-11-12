import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
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

interface Setup {
  document: Document;
  tab: ReturnType<typeof createPipelineTab>;
  requests: PullRequestRef[];
}

function setUp(evaluations = EVALUATIONS): Setup {
  const { document } = new JSDOM(PAGE, { url: `https://dev.azure.com${PULL_REQUEST_PATH}` }).window;
  const requests: PullRequestRef[] = [];
  const tab = createPipelineTab({
    apiBasePath: "/quillfield",
    document,
    getEvaluations: async (pullRequest) => {
      requests.push(pullRequest);
      return evaluations;
    },
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

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const pipelineTab = (document: Document): Element | null =>
  document.querySelector("[role=tablist] .fix-ado-pipeline-tab");
const checkNames = (document: Document): string[] =>
  [...document.querySelectorAll(".fix-ado-pipeline-check-name")].map((name) => name.textContent);
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

test("opening the tab lists the checks newest first and shows the newest run's steps", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  assert.equal(isOpen(document), true);
  assert.equal(pipelineTab(document)?.getAttribute("aria-selected"), "true");
  assert.equal(
    document.querySelector("#__bolt-tab-overview")?.getAttribute("aria-selected"),
    "false",
  );
  assert.deepEqual(checkNames(document), ["ledger-lint", "ledger-ci"]);
  assert.equal(
    frameSource(document),
    "/quillfield/Ledger%20Works/_build/results?buildId=502&view=logs",
  );
});

test("picking a check shows that run", async () => {
  const { document } = setUp();
  click(pipelineTab(document));
  await settle();
  click(document.querySelectorAll(".fix-ado-pipeline-check")[1] ?? null);
  assert.match(frameSource(document) ?? "", /buildId=501&/u);
  assert.equal(
    document.querySelectorAll(".fix-ado-pipeline-check")[1]?.getAttribute("aria-current"),
    "true",
  );
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
