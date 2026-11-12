import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
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
    timelinesByBuildId: Record<string, { body: { records: TimelineRecord[] } | null }>;
  };
}

function capturedPullRequestPage(): Document {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  const { data } = JSON.parse(fixtures.read("pr-detail.json")) as CapturedPullRequest;
  const html = fixtures
    .read("pr-detail.html")
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
    const document = capturedPullRequestPage();
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
