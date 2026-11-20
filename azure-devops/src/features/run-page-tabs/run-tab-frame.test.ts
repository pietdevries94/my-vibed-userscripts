import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createRunTabFrame } from "./run-tab-frame.ts";
import { test } from "node:test";

const RUN_URL = "https://dev.azure.com/quillfield/Ledger/_build/results?buildId=812";
const TAB_BAR = `<div class="run-details-page"><div class="bolt-tabbar"><div role="tablist">
  <a role="tab" id="__bolt-tab-results">Summary</a>
</div></div><div class="run-details-tab-content"></div></div>`;

function documentAt(url: string, body = ""): Document {
  return new JSDOM(`<!doctype html><body>${body}</body>`, { url }).window.document;
}

test("a run page tab in its frame is marked, so the styles leave only the tab's content", () => {
  const document = documentAt(`${RUN_URL}&view=results`, TAB_BAR);
  const frame = { dataset: {} as DOMStringMap };
  createRunTabFrame(document, frame)?.sync();
  assert.equal(document.documentElement.dataset.fixAdoRunTabFrame, "");
  assert.equal(frame.dataset.fixAdoMissingTab, undefined);
});

test("a run page without the tab tells the frame, once its tab bar is there", () => {
  const document = documentAt(`${RUN_URL}&view=codecoverage-tab`);
  const frame = { dataset: {} as DOMStringMap };
  const runTabFrame = createRunTabFrame(document, frame);
  runTabFrame?.sync();
  assert.equal(frame.dataset.fixAdoMissingTab, undefined, "no verdict while the tab bar loads");
  document.body.innerHTML = TAB_BAR;
  runTabFrame?.sync();
  assert.equal(frame.dataset.fixAdoMissingTab, "codecoverage-tab");
});

test("a link in a tab's content opens in a new browser tab", () => {
  const content = '<a href="https://review.example/7">Review slot</a>';
  const document = documentAt(
    `${RUN_URL}&view=results`,
    TAB_BAR.replace("</div></div></div>", `</div></div>`).replace(
      '<div class="run-details-tab-content"></div>',
      `<div class="run-details-tab-content">${content}</div>`,
    ),
  );
  createRunTabFrame(document, { dataset: {} })?.sync();
  const link = document.querySelector("a[href^='https']");
  const view = document.defaultView;
  assert.ok(link !== null && view !== null);
  link.dispatchEvent(new view.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(link.getAttribute("target"), "_blank");
  assert.equal(link.getAttribute("rel"), "noopener");
});

test("the Pipeline tab's log frame, and a run page on its own, are left alone", () => {
  assert.equal(
    createRunTabFrame(documentAt(`${RUN_URL}&view=logs&j=job&t=step`), { dataset: {} }),
    null,
  );
  assert.equal(createRunTabFrame(documentAt(`${RUN_URL}&view=results`), null), null);
});
