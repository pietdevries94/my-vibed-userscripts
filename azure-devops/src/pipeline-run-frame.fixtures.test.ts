import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

/** The parts style.css hides in the frame, and the log it leaves. */
const FRAME_PARTS = [
  ".project-header",
  ".navigation-container",
  ".run-logs-view > .bolt-master-panel",
  ".run-logs-view > .logs-view",
  // The log frame reads the step name here to see that the page switched.
  ".logs-view .log-header .job-header .title-m",
];

function capturedRunPage(page: string): Document {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
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

test(
  "the captured log page has every part the frame hides or keeps",
  { skip: fixtures.skip },
  () => {
    const document = capturedRunPage("pipeline-log");
    for (const selector of FRAME_PARTS) {
      assert.ok(document.querySelector(selector), `pipeline-log has ${selector}`);
    }
  },
);
