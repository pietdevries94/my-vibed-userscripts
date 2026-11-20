// The capture test harness: invented real values, the page and the answers the capture
// fetches, and a run of the capture menu command. Dev file only.
import { BUILD_POLICY_TYPE_ID } from "./pipeline/pipeline-status.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";

// Invented values that play the real ones. None of them may reach a capture file.
const ORGANISATION = "quillfield";
const PROJECT = "Ledger Works";
const REPOSITORY = "ledger-api";
const PULL_REQUEST_ID = 4711;
const BUILD_ID = 99_123;
const PERSON = "Quill Barrow";
const PROJECT_GUID = "6f9619ff-8b86-d011-b42d-00c04fc964ff";
const PERSON_GUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
const JOB_GUID = "3dc8fd7e-4368-5a92-293e-d53cefc8c4b3";
const STEP_GUID = "8c3e1b2a-77f0-5d1e-9a4b-6c2d0e9f1a35";
const REAL_VALUES = [
  ORGANISATION,
  PROJECT,
  REPOSITORY,
  String(PULL_REQUEST_ID),
  String(BUILD_ID),
  PERSON,
  PROJECT_GUID,
  PERSON_GUID,
  JOB_GUID,
  STEP_GUID,
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
  if (url.includes("/_apis/build/builds?")) {
    return Response.json({
      value: [{ buildNumber: `${PROJECT} 7`, id: BUILD_ID, result: "failed", status: "completed" }],
    });
  }
  if (url.includes("/timeline")) {
    const step = { id: STEP_GUID, name: `Test ${PROJECT}`, order: 3, parentId: JOB_GUID };
    return Response.json({
      records: [
        {
          ...step,
          errorCount: 1,
          issues: [
            { category: "General", message: `Lint ${PROJECT} failed`, type: "error" },
            { category: "General", message: `${PERSON} left a TODO`, type: "warning" },
          ],
          result: "failed",
          state: "completed",
          type: "Task",
          warningCount: 12,
        },
      ],
    });
  }
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

/** The pull request list capture's JSON, as far as the tests read it. */
interface CapturedPullRequestList {
  data: { evaluationsByPullRequestId: Record<string, { body: { value: { status: string }[] } }> };
}

interface CaptureRunResult {
  alerts: string[];
  files: Map<string, string>;
}

async function runCapture(page = PAGE, pageUrl = PAGE_URL): Promise<CaptureRunResult> {
  const { window } = new JSDOM(page, { url: pageUrl });
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

function assertNoRealValue(files: Map<string, string>): void {
  const text = [...files.values()].join("").toLowerCase();
  for (const value of REAL_VALUES) {
    assert.ok(!text.includes(value.toLowerCase()), `a real value is in the capture: ${value}`);
  }
}

export type { CapturedPullRequestList };
export {
  BUILD_ID,
  JOB_GUID,
  ORGANISATION,
  PERSON,
  PROJECT,
  ROW_LINK,
  STEP_GUID,
  assertNoRealValue,
  runCapture,
};
