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

for (const page of ["pr-detail-warnings", "pr-detail-duplicate-error"]) {
  test(
    `the captured Overview (${page}) shows the warning above the description, and leaves out the error the checks area shows`,
    {
      skip: fixtures.skip,
    },
    async () => {
      const document = await capturedOverview(page);
      const blocks = document.querySelectorAll(".fix-ado-overview-issues");
      assert.equal(blocks.length, 1, "one card, also where the capture holds an old one");
      const [block] = blocks;
      assert.match(block?.nextElementSibling?.className ?? "", /repos-pr-description-card/u);
      assert.deepEqual(issueKindsAndPlaces(document, ".fix-ado-overview-issues"), [
        "warning: place",
      ]);
      const link = block?.querySelector("a.fix-ado-issue")?.getAttribute("href");
      assert.match(link ?? "", /buildId=1001$/u);
    },
  );
}
