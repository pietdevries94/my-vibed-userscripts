import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createPipelineRunFrame } from "./pipeline-run-frame.ts";
import { test } from "node:test";

function documentAt(url: string): Document {
  return new JSDOM("<!doctype html><body></body>", { url }).window.document;
}

test("a run page in the frame is marked, so the styles leave only the log", () => {
  const document = documentAt(
    "https://dev.azure.com/quillfield/Ledger/_build/results?buildId=812&view=logs&j=job&t=step",
  );
  createPipelineRunFrame(document)?.sync();
  assert.equal(document.documentElement.dataset.fixAdoRunFrame, "");
});

test("a frame on another page is left alone", () => {
  const document = documentAt("https://dev.azure.com/quillfield/Ledger/_git/ledger-api");
  assert.equal(createPipelineRunFrame(document), null);
});
