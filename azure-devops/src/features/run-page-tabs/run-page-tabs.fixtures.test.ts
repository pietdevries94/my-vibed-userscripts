import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import { JSDOM } from "jsdom";
import type { RunTab } from "./run-tab-store.ts";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { createPullRequestRunTabs } from "./pull-request-run-tabs.ts";
import { createRunTabToggle } from "./run-tab-toggle.ts";
import { parsePullRequestHref } from "../../pull-requests/pull-request-link.ts";
import { runTabViewsIn } from "./run-tab-store.ts";
import { test } from "node:test";

/** A captured run page; captured from <body>, so the fixture becomes a <div>. */
function capturedRunPage(page: string): Document {
  const { document } = new JSDOM("<!doctype html><body></body>", {
    url: "https://dev.azure.com/fake-org/text-2/_build/results?buildId=1001&view=codecoverage-tab",
  }).window;
  const html = fixtures
    .read(`${page}.html`)
    .replace(/^<body\b/u, "<div")
    .replace(/<\/body>\s*$/u, "</div>");
  const root = buildFixtureDom(document, html);
  assert.ok(root);
  document.body.append(root);
  return document;
}

/** The parts a run page tab's frame hides, and the content it keeps. */
const FRAME_PARTS = [
  ".run-details-page > .run-view-header",
  ".run-details-page > .bolt-tabbar",
  ".run-details-page > .run-details-tab-content",
];

for (const page of ["pipeline-run-tab-coverage", "pipeline-run-tab-win98-coverage"]) {
  test(
    `the captured Code Coverage page (${page}) has its tabs, the parts the frame hides, and gets the switch`,
    { skip: fixtures.skip },
    async () => {
      const document = capturedRunPage(page);
      for (const selector of FRAME_PARTS) {
        assert.ok(document.querySelector(selector), `${page} has ${selector}`);
      }
      assert.deepEqual(runTabViewsIn(document), ["results", "codecoverage-tab"]);
      const saved: RunTab[][] = [];
      const toggle = createRunTabToggle({
        document,
        getBuildPipeline: async () => ({ id: 1022, name: "ledger-ci" }),
        storage: {
          load: () => saved.at(-1) ?? [],
          save: (tabs) => {
            saved.push(tabs);
          },
        },
      });
      toggle.sync();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      document.querySelector<HTMLButtonElement>(".bolt-tabbar > .fix-ado-run-tab-toggle")?.click();
      assert.deepEqual(
        saved.at(-1)?.map(({ pipelineId, view }) => [pipelineId, view]),
        [[1022, "codecoverage-tab"]],
      );
    },
  );
}

test(
  "the captured pull request (pr-detail-pipeline-tab-coverage) gets the Code Coverage tab of its check's pipeline",
  { skip: fixtures.skip },
  async () => {
    const { data, document, pullRequestPath } = loadCapturedPullRequest(
      "pr-detail-pipeline-tab-coverage",
    );
    const pullRequest = parsePullRequestHref(pullRequestPath, "/fake-org");
    assert.ok(pullRequest);
    const [check] = data.evaluations.body?.value ?? [];
    const pipelineId = check?.configuration.settings?.buildDefinitionId;
    assert.ok(pipelineId !== undefined, "the check names its pipeline");
    const tabs = createPullRequestRunTabs({
      apiBasePath: "/fake-org",
      document,
      getEvaluations: async () => data.evaluations.body?.value ?? [],
      getPullRequestBuilds: async () => data.builds?.body?.value ?? [],
      loadRunTabs: () => [
        { label: "Code Coverage", pipelineId, pipelineName: "ledger-ci", view: "codecoverage-tab" },
      ],
      now: () => 0,
    });
    tabs.sync(pullRequest, true);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    tabs.sync(pullRequest, true);
    const tab = document.querySelector(
      ".repos-pr-details-page-tabbar [role=tablist] .fix-ado-run-tab",
    );
    assert.equal(tab?.textContent.trim(), "Code Coverage");
    assert.equal(tab?.getAttribute("aria-disabled"), null);
  },
);
