import type { BuildPipeline } from "../../pipeline/build-requests.ts";
import { JSDOM } from "jsdom";
import type { RunTab } from "./run-tab-store.ts";
import assert from "node:assert/strict";
import { createRunTabToggle } from "./run-tab-toggle.ts";
import { test } from "node:test";

const RUN_URL = "https://dev.azure.com/quillfield/Ledger%20Works/_build/results?buildId=812";
const LEDGER_CI: BuildPipeline = { id: 31, name: "ledger-ci" };

const tab = (view: string, label: string, isSelected: boolean): string =>
  `<a class="bolt-tab" role="tab" id="__bolt-tab-${view}" aria-selected="${String(isSelected)}"><span class="bolt-tab-inner-container"><span class="bolt-tab-text">${label}</span></span></a>`;

/** A run page on its Deployments tab, an invented extension's. */
const RUN_PAGE = `<!doctype html><body><div class="run-details-page">
  <div class="bolt-tabbar"><div class="bolt-tabbar-tabs" role="tablist">
    ${tab("results", "Summary", false)}
    ${tab("quillfield.deploys.deploy-tab", "Deployments", true)}
  </div></div>
  <div class="run-details-tab-content">Deployed to the review slot</div>
</div></body>`;

interface Setup {
  document: Document;
  sync: () => void;
  store: { tabs: RunTab[] };
  lookups: [string, number][];
}

function setUp(
  saved: RunTab[] = [],
  lookUp: () => Promise<BuildPipeline> = async () => LEDGER_CI,
): Setup {
  const { document } = new JSDOM(RUN_PAGE, { url: `${RUN_URL}&view=quillfield.deploys.deploy-tab` })
    .window;
  const store = { tabs: saved };
  const lookups: [string, number][] = [];
  const toggle = createRunTabToggle({
    document,
    getBuildPipeline: async (project, buildId) => {
      lookups.push([project, buildId]);
      return lookUp();
    },
    storage: {
      load: () => store.tabs,
      save: (tabs) => {
        store.tabs = tabs;
      },
    },
  });
  toggle.sync();
  return { document, lookups, store, sync: toggle.sync };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const toggleOf = (document: Document): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>(".bolt-tabbar > .fix-ado-run-tab-toggle");

const deployments = (pipeline: BuildPipeline): RunTab => ({
  label: "Deployments",
  pipelineId: pipeline.id,
  pipelineName: pipeline.name,
  view: "quillfield.deploys.deploy-tab",
});

test("the tab bar gets a switch for the selected tab, off and disabled until the run's pipeline is known", async () => {
  const { document, lookups, store, sync } = setUp();
  const toggle = toggleOf(document);
  assert.equal(toggle?.getAttribute("role"), "switch");
  assert.equal(toggle?.textContent.trim(), "Show this tab in pull requests");
  assert.equal(toggle?.getAttribute("aria-checked"), "false");
  assert.equal(toggle?.disabled, true);
  await settle();
  sync();
  assert.equal(toggle?.disabled, false);
  assert.deepEqual(lookups, [["Ledger Works", 812]]);

  toggle?.click();
  assert.deepEqual(store.tabs, [deployments(LEDGER_CI)]);
  assert.equal(toggle?.getAttribute("aria-checked"), "true");
  toggle?.click();
  assert.deepEqual(store.tabs, []);
});

test("the setting is per pipeline: the same tab of another pipeline leaves the switch off", async () => {
  const other = deployments({ id: 44, name: "ledger-deploy" });
  const { document, store, sync } = setUp([other]);
  await settle();
  sync();
  assert.equal(toggleOf(document)?.getAttribute("aria-checked"), "false");
  toggleOf(document)?.click();
  assert.deepEqual(store.tabs, [other, deployments(LEDGER_CI)]);
});

test("the switch follows the selected tab", async () => {
  const summary: RunTab = {
    label: "Summary",
    pipelineId: 31,
    pipelineName: "ledger-ci",
    view: "results",
  };
  const { document, sync } = setUp([summary]);
  await settle();
  sync();
  assert.equal(toggleOf(document)?.getAttribute("aria-checked"), "false");
  document.querySelector("#__bolt-tab-results")?.setAttribute("aria-selected", "true");
  document
    .querySelector('[id="__bolt-tab-quillfield.deploys.deploy-tab"]')
    ?.setAttribute("aria-selected", "false");
  sync();
  assert.equal(toggleOf(document)?.getAttribute("aria-checked"), "true");
  assert.equal(document.querySelectorAll(".fix-ado-run-tab-toggle").length, 1);
});

test("when the run's pipeline cannot be read, the switch stays disabled and says why", async () => {
  const { document, sync } = setUp([], async () => {
    throw new Error("refused");
  });
  await settle();
  sync();
  assert.equal(toggleOf(document)?.disabled, true);
  assert.equal(
    toggleOf(document)?.title,
    "Could not read this run's pipeline. Reload to try again.",
  );
});

test("a page without a run tab bar gets no switch", () => {
  const { document } = new JSDOM("<!doctype html><body><div role=tablist></div></body>", {
    url: RUN_URL,
  }).window;
  createRunTabToggle({
    document,
    getBuildPipeline: async () => LEDGER_CI,
    storage: {
      load: () => [],
      save: () => {
        // A page without a switch saves nothing.
      },
    },
  }).sync();
  assert.equal(document.querySelector(".fix-ado-run-tab-toggle"), null);
});
