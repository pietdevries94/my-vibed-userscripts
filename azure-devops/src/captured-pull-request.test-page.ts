// A captured pull request page, with what Azure DevOps answered for it. The fixture
// tests of the Pipeline tab and of the Overview share it. Test code only.
import { JSDOM } from "jsdom";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestBuild } from "./pipeline-checks.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedPullRequest {
  data: {
    evaluations: { body: { value: PolicyEvaluation[] } | null };
    builds?: { body: { value: PullRequestBuild[] } | null };
    timelinesByBuildId: Record<string, { body: { records: TimelineRecord[] } | null }>;
  };
}

interface CapturedPage {
  data: CapturedPullRequest["data"];
  document: Document;
  pullRequestPath: string;
}
/** A captured pull request page, with what Azure DevOps answered for it. */
function loadCapturedPullRequest(page: string): CapturedPage {
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
  return { data, document, pullRequestPath: tabLink };
}

function timelineOf(data: CapturedPullRequest["data"], buildId: number): TimelineRecord[] {
  return data.timelinesByBuildId[String(buildId)]?.body?.records ?? [];
}

/** The issue rows under `selector`, as "kind: place", where the place is there or not. */
const issueKindsAndPlaces = (document: Document, selector: string): string[] =>
  [...document.querySelectorAll<HTMLElement>(`${selector} .fix-ado-issue`)].map(
    (row) =>
      `${row.dataset.kind ?? ""}: ${row.querySelector(".fix-ado-issue-place")?.textContent === "" ? "no place" : "place"}`,
  );

export { loadCapturedPullRequest, fixtures, issueKindsAndPlaces, timelineOf };
