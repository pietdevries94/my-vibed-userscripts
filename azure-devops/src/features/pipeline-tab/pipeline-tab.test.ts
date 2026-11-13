import {
  PULL_REQUEST,
  click,
  frameSource,
  isOpen,
  pipelineTab,
  setUp,
  settle,
  treeNames,
} from "./pipeline-tab.test-page.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import assert from "node:assert/strict";
import { logEntries } from "../../../../shared/runtime/script-log.ts";
import { test } from "node:test";

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

test("a link to a step's log on the pull request opens the tab on that step", async () => {
  const { document } = setUp();
  const link = document.createElement("a");
  link.href =
    "/quillfield/Ledger%20Works/_build/results?buildId=502&view=logs&j=build-job&t=checkout";
  document.querySelector(".page-content")?.append(link);
  click(link);
  await settle();
  assert.deepEqual(treeNames(document, "step"), ["checkout*", "compile"]);
  assert.match(frameSource(document) ?? "", /buildId=502&view=logs&j=build-job&t=checkout$/u);
});

test("a button inside a run link, such as re-queue, works as Azure DevOps made it", async () => {
  const { document } = setUp();
  let requeueClicks = 0;
  document.querySelector(".page-content")?.addEventListener("click", (event) => {
    if (!event.defaultPrevented) {
      requeueClicks += 1;
    }
  });
  click(document.querySelector(".page-content a.check button span"));
  await settle();
  assert.equal(isOpen(document), false);
  assert.equal(requeueClicks, 1);
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
  assert.deepEqual(treeNames(document, "run"), ["ledger-lint", "ledger-ci*"]);
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

test("when the run list does not load, the checks' runs show and the script log says why", async () => {
  const { document } = setUp(undefined, undefined, async () => {
    throw new AdoRequestError(403, null);
  });
  click(pipelineTab(document));
  await settle();
  assert.deepEqual(treeNames(document, "run"), ["ledger-lint*", "ledger-ci"]);
  assert.deepEqual(logEntries().at(-2), {
    data: { httpStatus: 403 },
    message: "Pipeline tab: Azure DevOps refused the run list",
  });
});
