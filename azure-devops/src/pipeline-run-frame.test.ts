import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createPipelineRunFrame } from "./pipeline-run-frame.ts";
import { test } from "node:test";

const RUN_PAGE = `<!doctype html><body>
  <div class="project-header" role="banner"></div>
  <div class="navigation-container"></div>
  <div class="run-logs-view">
    <div class="bolt-master-panel">
      <button class="bolt-header-back-button"></button>
      <div class="run-logs-tree"><table><tbody>
        <tr class="bolt-tree-row" aria-level="1" id="job">
          <td><span class="bolt-tree-expand-button"></span><span role="button">build</span></td>
        </tr>
        <tr class="bolt-tree-row" aria-level="2" id="step">
          <td><span role="button">npm test</span></td>
        </tr>
      </tbody></table></div>
    </div>
    <div class="logs-view"><div class="log-header"><div role="heading">npm test</div></div></div>
  </div>
</body>`;

function setUp(search = "?buildId=812&view=logs"): Document {
  const { document } = new JSDOM(RUN_PAGE, {
    url: `https://dev.azure.com/quillfield/Ledger/_build/results${search}`,
  }).window;
  return document;
}

function viewOf(document: Document): string | undefined {
  return document.documentElement.dataset.fixAdoRunView;
}

function click(element: Element | null): void {
  assert.ok(element);
  element.dispatchEvent(
    new (element.ownerDocument.defaultView ?? globalThis).MouseEvent("click", { bubbles: true }),
  );
}

test("the run opens on the steps overview", () => {
  const document = setUp();
  createPipelineRunFrame(document)?.sync();
  assert.equal(viewOf(document), "steps");
});

test("a run opened on a step's log shows that log", () => {
  const document = setUp("?buildId=812&view=logs&j=job-1&t=step-1");
  createPipelineRunFrame(document)?.sync();
  assert.equal(viewOf(document), "log");
});

test("clicking a step shows its log, and Back returns to the steps", () => {
  const document = setUp();
  const frame = createPipelineRunFrame(document);
  assert.ok(frame);
  frame.sync();
  click(document.querySelector("#step [role=button]"));
  assert.equal(viewOf(document), "log");

  frame.sync();
  const backButtons = document.querySelectorAll(".log-header .fix-ado-run-back");
  assert.equal(backButtons.length, 1);
  frame.sync();
  assert.equal(document.querySelectorAll(".log-header .fix-ado-run-back").length, 1);

  click(backButtons[0] ?? null);
  assert.equal(viewOf(document), "steps");
});

test("a frame on another page is left alone", () => {
  const { document } = new JSDOM(RUN_PAGE, {
    url: "https://dev.azure.com/quillfield/Ledger/_git/ledger-api",
  }).window;
  assert.equal(createPipelineRunFrame(document), null);
});

test("expanding or collapsing a job keeps the steps overview", () => {
  const document = setUp();
  createPipelineRunFrame(document)?.sync();
  click(document.querySelector("#job .bolt-tree-expand-button"));
  assert.equal(viewOf(document), "steps");
});
