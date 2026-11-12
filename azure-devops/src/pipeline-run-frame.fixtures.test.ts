import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { createPipelineRunFrame } from "./pipeline-run-frame.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);
const RUN_URL = "https://dev.azure.com/fake-org/text-16/_build/results?buildId=1001&view=logs";

/** The parts style.css hides or shows in the frame. */
const FRAME_PARTS = [
  ".project-header",
  ".navigation-container",
  ".run-logs-view > .bolt-master-panel",
  ".bolt-master-panel .bolt-header-back-button",
  ".run-logs-view > .logs-view",
];

function capturedRunPage(page: string): Document {
  const { document } = new JSDOM("<!doctype html><body></body>", { url: RUN_URL }).window;
  // Captured from <body>; a page has one body, so the fixture becomes a <div>.
  const html = fixtures
    .read(`${page}.html`)
    .replace(/^<body\b/u, "<div")
    .replace(/<\/body>\s*$/u, "</div>");
  const root = buildFixtureDom(document, html);
  if (root === null) {
    throw new Error("the fixture has no root element");
  }
  document.body.append(root);
  return document;
}

for (const page of ["pipeline-steps", "pipeline-log"]) {
  test(
    `the ${page} capture has every part the frame hides or shows`,
    { skip: fixtures.skip },
    () => {
      const document = capturedRunPage(page);
      for (const selector of FRAME_PARTS) {
        assert.ok(document.querySelector(selector), `${page} has ${selector}`);
      }
    },
  );
}

test(
  "the captured steps get a Back button in the log header, and a step click shows the log",
  {
    skip: fixtures.skip,
  },
  () => {
    const document = capturedRunPage("pipeline-steps");
    const frame = createPipelineRunFrame(document);
    assert.ok(frame, "the captured run page is a run page");
    frame.sync();
    assert.equal(document.documentElement.dataset.fixAdoRunView, "steps");
    assert.equal(document.querySelectorAll(".log-header .fix-ado-run-back").length, 1);

    const step = document.querySelector(
      '.run-logs-tree .bolt-tree-row[aria-level="2"] [role=button]',
    );
    assert.ok(step, "a step row");
    step.dispatchEvent(
      new (document.defaultView ?? globalThis).MouseEvent("click", { bubbles: true }),
    );
    assert.equal(document.documentElement.dataset.fixAdoRunView, "log");
  },
);
