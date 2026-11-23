import {
  BUILD_ID,
  JOB_GUID,
  ORGANISATION,
  PERSON,
  PROJECT,
  ROW_LINK,
  STEP_GUID,
  assertNoRealValue,
  runCapture,
} from "./capture.test-page.ts";
import type { CapturedPullRequestList } from "./capture.test-page.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createPseudonyms } from "../../shared/dev/scrub/pseudonyms.ts";
import { findPullRequestRows } from "./pull-requests/pr-list.ts";
import { scrubJson } from "../../shared/dev/scrub/scrub-json.ts";
import { test } from "node:test";

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

test("a Files tab capture is its own page, and its tab links keep their tab", async () => {
  const tabLink = `${ROW_LINK}?_a=files&path=/${encodeURIComponent(PROJECT)}/totals.ts`;
  const page = `<!doctype html><body><a role="tab" href="${tabLink}">Files</a><button>Approve with suggestions</button></body>`;
  const { alerts, files } = await runCapture(page, `https://dev.azure.com${ROW_LINK}?_a=files`);
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["azure-devops--pr-files.html", "azure-devops--pr-files.json", "azure-devops--pr-files.css"],
  );
  assertNoRealValue(files);
  const html = files.get("azure-devops--pr-files.html") ?? "";
  assert.match(html, /href="\/fake-org\/text-\d+\/_git\/text-\d+\/pullrequest\/\d+\?_a=files"/u);
  assert.match(html, />Approve with suggestions</u);
});

test("a pipeline log capture keeps the job and step of its links as stand-ins", async () => {
  const stepLink = `/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_build/results?buildId=${BUILD_ID}&view=logs&j=${JOB_GUID}&t=${STEP_GUID}`;
  const page = `<!doctype html><body><a href="${stepLink}">Logs</a></body>`;
  const { alerts, files } = await runCapture(page, `https://dev.azure.com${stepLink}`);
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["html", "json", "css"].map((kind) => `azure-devops--pipeline-log.${kind}`),
  );
  assertNoRealValue(files);
  assert.match(
    files.get("azure-devops--pipeline-log.html") ?? "",
    /buildId=\d+&amp;view=logs&amp;j=0{8}-[\d-]+&amp;t=0{8}-[\d-]+/u,
  );
});

test("a run page on one of its tabs is its own page, and keeps the tab bar's views and labels", async () => {
  const runPath = `/${ORGANISATION}/${encodeURIComponent(PROJECT)}/_build/results?buildId=${BUILD_ID}`;
  const tab = (id: string, view: string | null, label: string): string =>
    `<a role="tab" id="__bolt-tab-${id}" href="${runPath}${view === null ? "" : `&view=${view}`}"><span class="bolt-tab-text">${label}</span></a>`;
  const page = `<!doctype html><body><div role="tablist">
    ${tab("results", null, "Summary")}
    ${tab("ms.vss-build-web.run-extensions-tab", "ms.vss-build-web.run-extensions-tab", "Extensions")}
    ${tab("codecoverage-tab", "codecoverage-tab", "Code Coverage")}
    ${tab(`${ORGANISATION}.deploys.deploy-tab`, `${ORGANISATION}.deploys.deploy-tab`, `${PROJECT} deploys`)}
  </div></body>`;
  const { alerts, files } = await runCapture(
    page,
    `https://dev.azure.com${runPath}&view=codecoverage-tab`,
  );
  assert.deepEqual(alerts, []);
  assert.deepEqual(
    [...files.keys()],
    ["html", "json", "css"].map((kind) => `azure-devops--pipeline-run-tab.${kind}`),
  );
  assertNoRealValue(files);
  const html = files.get("azure-devops--pipeline-run-tab.html") ?? "";
  for (const view of ["codecoverage-tab", "ms.vss-build-web.run-extensions-tab"]) {
    assert.ok(html.includes(`id="__bolt-tab-${view}"`), `the tab ${view} keeps its id`);
    assert.match(
      html,
      new RegExp(String.raw`buildId=\d+&amp;view=${view.replaceAll(".", String.raw`\.`)}"`, "u"),
    );
  }
  assert.match(html, />Code Coverage</u);
  assert.match(html, />Extensions</u);
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

test("the capture keeps the file tree's layout: kinds, row numbers and pixels", async () => {
  const { captureDefinition } = await import("./capture.ts");
  const data = { treeLayout: { rows: ["own-spacer::-12:76", "row:7:64:35"], view: "480:900" } };
  const scrubbed = scrubJson({ data }, captureDefinition.rules, createPseudonyms());
  assert.deepEqual(scrubbed, { data });
});

test("the capture keeps the activity feed's layout: kinds of rows and pixels", async () => {
  const { captureDefinition } = await import("./capture.ts");
  const data = {
    feedLayout: {
      rows: ["push-folded:1245:1245:1245:1245:1236:auto", "row:52:52:52:52:0:set"],
      windowWidth: 1280,
    },
  };
  const scrubbed = scrubJson({ data }, captureDefinition.rules, createPseudonyms());
  assert.deepEqual(scrubbed, { data });
});

test("the capture keeps the counts and durations the viewed files feature logs, and no text", async () => {
  const { captureDefinition } = await import("./capture.ts");
  const timing = { viewedFilesTiming: { asked: 26, missed: 0, ms: 4210 } };
  const kept = scrubJson(timing, captureDefinition.rules, createPseudonyms());
  assert.deepEqual(kept, timing);
  const named = scrubJson(
    { viewedFilesTiming: { folder: "Holt" } },
    captureDefinition.rules,
    createPseudonyms(),
  );
  assert.notDeepEqual(named, { viewedFilesTiming: { folder: "Holt" } });
});

test("a work item capture describes its avatars without their names", async () => {
  const workItemUrl = `https://dev.azure.com/${ORGANISATION}/${PROJECT}/_workitems/edit/${BUILD_ID}/`;
  const avatar = `<div class="vss-Persona" aria-label="Barrow, Quill"><img alt="${PERSON}"></div>`;
  const { files } = await runCapture(`<!doctype html><body>${avatar}</body>`, workItemUrl);
  const json = files.get("azure-devops--work-item.json") ?? "";
  assert.ok(files.has("azure-devops--work-item.css"));
  assert.ok(!json.includes("Barrow"));
  assertNoRealValue(files);
  const shape = json.replaceAll(/\s/gu, "");
  assert.match(shape, /"hasComma":true,.*"isScriptAvatar":true,"nameSource":"aria-label",/u);
});
