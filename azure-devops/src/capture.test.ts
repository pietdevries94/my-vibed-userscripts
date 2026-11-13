import { BUILD_POLICY_TYPE_ID } from "./pipeline/pipeline-status.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createPseudonyms } from "../../shared/dev/scrub/pseudonyms.ts";
import { findPullRequestRows } from "./pull-requests/pr-list.ts";
import { scrubJson } from "../../shared/dev/scrub/scrub-json.ts";
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

test("a pull request list capture keeps no real value and lines up its stand-ins", async () => {
  const { alerts, files } = await runCapture();
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["azure-devops--pr-list.html", "azure-devops--pr-list.json", "azure-devops--pr-list.css"],
  );
  assertNoRealValue(files);
  const html = files.get("azure-devops--pr-list.html") ?? "";
  const json = files.get("azure-devops--pr-list.json") ?? "";

  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const [row] = findPullRequestRows(document, "/fake-org");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the shape capture.ts writes
  const captured = JSON.parse(json) as CapturedPullRequestList;
  assert.doesNotMatch(html, /fix-ado/u, "the script's own marks are left out");
  const evaluations =
    captured.data.evaluationsByPullRequestId[String(row?.pullRequest.pullRequestId)];
  assert.equal(evaluations?.body.value[0]?.status, "approved");
});

function assertNoRealValue(files: Map<string, string>): void {
  const text = [...files.values()].join("").toLowerCase();
  for (const value of REAL_VALUES) {
    assert.ok(!text.includes(value.toLowerCase()), `a real value is in the capture: ${value}`);
  }
}

test("a pull request page capture saves the CSS that applies to it, without links", async () => {
  const page = `<!doctype html><head><style>
    .check:hover { color: red; } .absent { color: blue; }
    .bolt-coin { background: url(/${ORGANISATION}/_apis/avatar) no-repeat; }
  </style></head><body><div class="bolt-coin"></div><a class="check">${PROJECT}</a></body>`;
  const { files } = await runCapture(page, `https://dev.azure.com${ROW_LINK}`);
  assertNoRealValue(files);
  const css = files.get("azure-devops--pr-detail.css") ?? "";
  assert.match(css, /\.check:hover/u);
  assert.match(css, /\.bolt-coin \{ background: none no-repeat/u);
  assert.doesNotMatch(css, /\.absent/u);
});

test("a pull request page capture keeps its tabs, its run links and its evaluations", async () => {
  const runLink = `/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_build/results?buildId=${BUILD_ID}`;
  const page = `<!doctype html><body>
    <div role="tablist"><a role="tab">Overview</a><a role="tab">Files</a></div>
    <a class="check" href="${runLink}">${PROJECT} build</a>
    <section class="fix-ado-overview-issues"><span class="error-text">Lint failed</span></section>
  </body>`;
  const { alerts, files } = await runCapture(page, `https://dev.azure.com${ROW_LINK}`);
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["azure-devops--pr-detail.html", "azure-devops--pr-detail.json", "azure-devops--pr-detail.css"],
  );
  assertNoRealValue(files);
  const html = files.get("azure-devops--pr-detail.html") ?? "";
  assert.match(html, />Overview</u);
  assert.doesNotMatch(
    html,
    /fix-ado-overview-issues|error-text/u,
    "the script's own card is left out",
  );
  const json = files.get("azure-devops--pr-detail.json") ?? "";
  assert.match(json, /"type": "Task"/u);
  assert.match(json, /"result": "failed"/u);
  assert.match(json, /"order": 3/u);
  assert.match(json, /"type": "error"[^}]*\}[^}]*"type": "warning"/u);
  assert.match(json, /"warningCount": 12/u);
  assert.match(json, /"errorCount": 1\b/u);
  assert.match(
    json,
    /"result": "failed",\s*"status": "completed"|"status": "completed"[^}]*"result": "failed"/u,
  );
  assert.match(html, /href="\/fake-org\/text-\d+\/_build\/results\?buildId=\d+"/u);
});

test("a pipeline log capture keeps the job and step of its links as stand-ins", async () => {
  const stepLink = `/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_build/results?buildId=${BUILD_ID}&view=logs&j=${JOB_GUID}&t=${STEP_GUID}`;
  const page = `<!doctype html><body><a href="${stepLink}">Logs</a></body>`;
  const { alerts, files } = await runCapture(page, `https://dev.azure.com${stepLink}`);
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["azure-devops--pipeline-log.html", "azure-devops--pipeline-log.json"],
  );
  assertNoRealValue(files);
  assert.match(
    files.get("azure-devops--pipeline-log.html") ?? "",
    /buildId=\d+&amp;view=logs&amp;j=0{8}-[\d-]+&amp;t=0{8}-[\d-]+/u,
  );
});

test("the capture keeps the kinds of identities a search found, and drops their names", async () => {
  const { captureDefinition } = await import("./capture.ts");
  const logged = {
    found: [
      {
        entityType: "User",
        fields: { displayName: true, localId: true },
        hasLocalId: false,
        originDirectory: "aad",
        title: PERSON,
      },
    ],
    foundCount: 1,
  };
  const scrubbed = JSON.stringify(scrubJson(logged, captureDefinition.rules, createPseudonyms()));
  assert.match(scrubbed, /"entityType":"User"/u);
  assert.match(scrubbed, /"originDirectory":"aad"/u);
  assert.match(scrubbed, /"hasLocalId":false/u);
  assert.match(scrubbed, /"foundCount":1/u);
  assert.match(scrubbed, /"fields":\{"displayName":true,"localId":true\}/u);
  assert.ok(!scrubbed.includes(PERSON));
});
