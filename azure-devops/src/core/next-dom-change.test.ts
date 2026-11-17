import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { onNextDomChange } from "./next-dom-change.ts";
import { test } from "node:test";

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("runs once on the next change, also an attribute", async () => {
  const { document } = new JSDOM("<body><p></p></body>").window;
  let calls = 0;
  onNextDomChange(document, () => {
    calls += 1;
  });
  document.querySelector("p")?.setAttribute("title", "x");
  await settle();
  document.body.append(document.createElement("p"));
  await settle();
  assert.equal(calls, 1);
});

test("a cancelled wait does not run", async () => {
  const { document } = new JSDOM("<body></body>").window;
  let calls = 0;
  const cancel = onNextDomChange(document, () => {
    calls += 1;
  });
  cancel();
  document.body.append(document.createElement("p"));
  await settle();
  assert.equal(calls, 0);
});
