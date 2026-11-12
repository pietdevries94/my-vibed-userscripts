import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestBuild } from "./pipeline-checks.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { createPipelineTab } from "./pipeline-tab.ts";
import { parsePullRequestHref } from "./pull-request-link.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedPullRequest {
  data: {
    evaluations: { body: { value: PolicyEvaluation[] } | null };
    builds?: { body: { value: PullRequestBuild[] } | null };
    timelinesByBuildId: Record<string, { body: { records: TimelineRecord[] } | null }>;
  };
}

/** A captured pull request page with the Pipeline tab on it, answered from the capture. */
function capturedPullRequestPage(page: string): Document {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  const { data } = JSON.parse(fixtures.read(`${page}.json`)) as CapturedPullRequest;
  const html = fixtures
    .read(`${page}.html`)
    .replace(/^<body\b/u, "<div")
    .replace(/<\/body>\s*$/u, "</div>");
  const tabLink = /href="(?<path>\/fake-org\/[^"]+\/pullrequest\/\d+)"/u.exec(html)?.groups?.path;
  assert.ok(tabLink !== undefined, "the capture links to its pull request");
  const { document } = new JSDOM("<!doctype html><body></body>", {
    url: `https://dev.azure.com${tabLink}`,
  }).window;
  const root = buildFixtureDom(document, html);
  assert.ok(root);
  document.body.append(root);
  const tab = createPipelineTab({
    apiBasePath: "/fake-org",
    document,
    getEvaluations: async () => data.evaluations.body?.value ?? [],
    getPullRequestBuilds: async () => data.builds?.body?.value ?? [],
    getTimeline: async (_project, buildId) =>
      data.timelinesByBuildId[String(buildId)]?.body?.records ?? [],
    now: () => 0,
  });
  tab.sync(parsePullRequestHref(tabLink, "/fake-org"));
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
  "the captured running pull request opens its running run on the running step",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = capturedPullRequestPage("pr-detail");
    await openPipelineTab(document);
    const label = (selector: string): string | null | undefined =>
      document.querySelector(`${selector}[aria-current=true] svg`)?.getAttribute("aria-label");
    assert.equal(document.querySelectorAll(".fix-ado-pipeline-run").length, 6);
    assert.equal(label(".fix-ado-pipeline-run"), "Pipeline running");
    assert.equal(label(".fix-ado-pipeline-step"), "Running");
  },
);
