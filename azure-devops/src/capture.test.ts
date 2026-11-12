import { BUILD_POLICY_TYPE_ID } from "./pipeline-status.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { findPullRequestRows } from "./pr-list.ts";
import { test } from "node:test";

// Invented values that play the real ones. None of them may reach a capture file.
const ORGANISATION = "quillfield";
const PROJECT = "Ledger Works";
const REPOSITORY = "ledger-api";
const PULL_REQUEST_ID = 4711;
const BUILD_ID = 99_123;
const PERSON = "Quill Barrow";
const PROJECT_GUID = "6f9619ff-8b86-d011-b42d-00c04fc964ff";
const PERSON_GUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
const REAL_VALUES = [
  ORGANISATION,
  PROJECT,
  REPOSITORY,
  String(PULL_REQUEST_ID),
  String(BUILD_ID),
  PERSON,
  PROJECT_GUID,
  PERSON_GUID,
];

const PAGE_URL = `https://dev.azure.com/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_git/${REPOSITORY}/pullrequests`;
const ROW_LINK = `/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_git/${REPOSITORY}/pullrequest/${PULL_REQUEST_ID}`;
const PAGE = `<!doctype html><body><div class="page-content">
  <a class="bolt-table-row" href="${ROW_LINK}">
    <div class="bolt-table-two-line-cell-item"><span>Fix the totals of ${PROJECT}</span><svg class="fix-ado-pipeline-status"></svg></div>
    <div class="pr-reviewer" data-fix-ado-required=""><div class="bolt-coin" aria-label="${PERSON}" data-fix-ado-initials="QB" style="--fix-ado-hue: 120"><img alt="${PERSON}"></div></div>
  </a>
</div></body>`;

function respond(url: string): Response {
  if (url.includes("/_apis/projects/")) {
    return Response.json({ id: PROJECT_GUID, name: PROJECT });
  }
  if (url.includes("/_apis/policy/evaluations")) {
    const configuration = {
      isBlocking: true,
      type: { displayName: "Build", id: BUILD_POLICY_TYPE_ID },
    };
    return Response.json({
      value: [{ configuration, context: { buildId: BUILD_ID }, status: "approved" }],
    });
  }
  const reviewer = { displayName: PERSON, id: PERSON_GUID, isRequired: true, vote: 10 };
  return Response.json({
    value: [
      {
        pullRequestId: PULL_REQUEST_ID,
        reviewers: [reviewer],
        status: "active",
        title: `Fix ${PROJECT}`,
      },
    ],
  });
}

interface CapturedPullRequestList {
  data: { evaluationsByPullRequestId: Record<string, { body: { value: { status: string }[] } }> };
}

interface CaptureRunResult {
  alerts: string[];
  files: Map<string, string>;
}

async function runCapture(): Promise<CaptureRunResult> {
  const { window } = new JSDOM(PAGE, { url: PAGE_URL });
  const alerts: string[] = [];
  const blobs: Blob[] = [];
  const names: string[] = [];
  const commands: (() => void)[] = [];
  window.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement): void {
    names.push(this.download);
  };
  Object.assign(globalThis, {
    GM_registerMenuCommand: (_caption: string, onClick: () => void) => {
      commands.push(onClick);
    },
    addEventListener: (): void => undefined,
    alert: (message: string) => alerts.push(message),
    document: window.document,
    fetch: async (url: string) => respond(url),
    getComputedStyle: window.getComputedStyle.bind(window),
    location: window.location,
  });
  URL.createObjectURL = (blob: Blob): string => {
    blobs.push(blob);
    return "blob:capture";
  };
  URL.revokeObjectURL = (): void => undefined;
  const { captureDefinition } = await import("./capture.ts");
  const { registerCapture } = await import("../../shared/dev/capture/capture.ts");
  registerCapture(captureDefinition);
  for (const command of commands) {
    command();
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
  const texts = await Promise.all(blobs.map(async (blob) => blob.text()));
  return { alerts, files: new Map(names.map((name, index) => [name, texts[index] ?? ""])) };
}

test("a pull request list capture keeps no real value and lines up its stand-ins", async () => {
  const { alerts, files } = await runCapture();
  assert.deepEqual(alerts, []);
  assert.deepEqual([...files.keys()], ["azure-devops--pr-list.html", "azure-devops--pr-list.json"]);
  const html = files.get("azure-devops--pr-list.html") ?? "";
  const json = files.get("azure-devops--pr-list.json") ?? "";
  for (const value of REAL_VALUES) {
    assert.ok(
      !`${html}${json}`.toLowerCase().includes(value.toLowerCase()),
      `a real value is in the capture: ${value}`,
    );
  }

  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const [row] = findPullRequestRows(document, "/fake-org");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the shape capture.ts writes
  const captured = JSON.parse(json) as CapturedPullRequestList;
  assert.doesNotMatch(html, /fix-ado/u, "the script's own marks are left out");
  const evaluations =
    captured.data.evaluationsByPullRequestId[String(row?.pullRequest.pullRequestId)];
  assert.equal(evaluations?.body.value[0]?.status, "approved");
});
