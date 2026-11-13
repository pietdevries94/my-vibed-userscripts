import {
  fixtures,
  issueKindsAndPlaces,
  loadCapturedPullRequest,
  timelineOf,
} from "./captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createOverviewPipelineIssues } from "./overview-pipeline-issues.ts";
import { parsePullRequestHref } from "./pull-request-link.ts";
import { test } from "node:test";

/** A captured pull request page with the checks' warnings and errors on its Overview. */
async function capturedOverview(page: string): Promise<Document> {
  const { data, document, pullRequestPath } = loadCapturedPullRequest(page);
  const overview = createOverviewPipelineIssues({
    apiBasePath: "/fake-org",
    document,
    getEvaluations: async () => data.evaluations.body?.value ?? [],
    getTimeline: async (_project, buildId) => timelineOf(data, buildId),
    now: () => 0,
  });
  overview.sync(parsePullRequestHref(pullRequestPath, "/fake-org"), true);
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
  return document;
}

test(
  "the captured Overview shows the check's error and warning above the description",
  {
    skip: fixtures.skip,
  },
  async () => {
    const document = await capturedOverview("pr-detail-warnings");
    const block = document.querySelector(".fix-ado-overview-issues");
    assert.ok(block, "the block is there");
    assert.match(block.nextElementSibling?.className ?? "", /repos-pr-description-card/u);
    assert.deepEqual(issueKindsAndPlaces(document, ".fix-ado-overview-issues"), [
      "error: place",
      "warning: place",
    ]);
    const links = [...block.querySelectorAll("a.fix-ado-issue")].map((link) =>
      link.getAttribute("href"),
    );
    assert.match(links[0] ?? "", /buildId=1001&view=logs&j=[\w-]+&t=[\w-]+$/u);
    assert.match(links[1] ?? "", /buildId=1001$/u);
  },
);
