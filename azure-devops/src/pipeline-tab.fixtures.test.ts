import {
  fixtures,
  issueKindsAndPlaces,
  loadCapturedPullRequest,
  timelineOf,
} from "./captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createPipelineTab } from "./pipeline-tab.ts";
import { parsePullRequestHref } from "./pull-request-link.ts";
import { test } from "node:test";

/** A captured pull request page with the Pipeline tab on it, answered from the capture. */
function capturedPullRequestPage(page: string): Document {
  const { data, document, pullRequestPath } = loadCapturedPullRequest(page);
  const tab = createPipelineTab({
    apiBasePath: "/fake-org",
    cancelRun: async () => {
      assert.fail("the fixture tests cancel no run");
    },
    document,
    getEvaluations: async () => data.evaluations.body?.value ?? [],
    getPullRequestBuilds: async () => data.builds?.body?.value ?? [],
    getTimeline: async (_project, buildId) => timelineOf(data, buildId),
    now: () => 0,
    requeueCheck: async () => {
      assert.fail("the fixture tests start no run");
    },
  });
  tab.sync(parsePullRequestHref(pullRequestPath, "/fake-org"));
  return document;
}

test(
  "a run in the captured checks panel opens the Pipeline tab and closes the panel",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail-one-run");
    const view = document.defaultView;
    assert.ok(view);
    const link = document.querySelector('.bolt-panel a[href*="/_build/results?"]');
    assert.ok(link, "the checks panel has a run link");
    let panelCloses = 0;
    document
      .querySelector(".bolt-panel-header .ms-Icon--Clear")
      ?.closest("button")
      ?.addEventListener("click", () => {
        panelCloses += 1;
      });
    const event = new view.MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    assert.equal(event.defaultPrevented, true, "the link does not go to the Pipelines page");
    assert.equal(panelCloses, 1);
    assert.ok(document.querySelector(".fix-ado-pipeline-step[aria-current=true]"));
  },
);

test(
  "the button in the captured failed run's row stays Azure DevOps's own",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail-failed");
    const view = document.defaultView;
    assert.ok(view);
    const button = document.querySelector('a[href*="/_build/results?"] button');
    assert.ok(button, "the failed run's row has a button");
    const event = new view.MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    assert.equal(event.defaultPrevented, false);
    assert.equal(document.querySelector(".fix-ado-pipeline-panel"), null);
  },
);

async function openPipelineTab(document: Document): Promise<void> {
  const view = document.defaultView;
  assert.ok(view);
  document
    .querySelector(".fix-ado-pipeline-tab")
    ?.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }));
  for (let round = 0; round < 3; round += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each round lets the next answer in
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

const itemDetails = (document: Document, kind: string): string[] =>
  [...document.querySelectorAll(`.fix-ado-pipeline-${kind} .fix-ado-pipeline-item-details`)].map(
    (details) => details.textContent.split(" · ")[0] ?? "",
  );

test(
  "the captured pull request lists all its runs; the check's run is Required",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail-three-runs");
    await openPipelineTab(document);
    const kinds = itemDetails(document, "run");
    assert.equal(kinds.length, 3);
    assert.equal(kinds.filter((kind) => kind === "Required").length, 1);
    assert.equal(kinds.filter((kind) => kind.startsWith("#")).length, 2);
  },
);

test(
  "the captured failed run opens on a failed step, and lists its skipped stage",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail-failed");
    await openPipelineTab(document);
    const step = document.querySelector(".fix-ado-pipeline-step[aria-current=true] svg");
    assert.equal(step?.getAttribute("aria-label"), "Failed");
    const stageLabels = [...document.querySelectorAll(".fix-ado-pipeline-stage svg")].map((icon) =>
      icon.getAttribute("aria-label"),
    );
    assert.deepEqual(stageLabels, ["Failed", "Skipped"]);
  },
);

test(
  "the captured failed run lists its error, then its warning, and counts them on its stage",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail-warnings");
    await openPipelineTab(document);
    assert.deepEqual(issueKindsAndPlaces(document, ".fix-ado-pipeline-panel"), [
      "error: place",
      "warning: place",
    ]);
    const stageCounts = [
      ...document.querySelectorAll(".fix-ado-pipeline-stage .fix-ado-issue-count"),
    ].map((count) => count.getAttribute("aria-label"));
    assert.deepEqual(
      stageCounts.toSorted((first, second) => (first ?? "").localeCompare(second ?? "")),
      ["1 error", "1 warning"],
    );
  },
);
