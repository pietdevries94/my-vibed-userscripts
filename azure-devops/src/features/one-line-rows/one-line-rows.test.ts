import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showOneLineRows } from "./one-line-rows.ts";
import { test } from "node:test";

/** The test reads the records with takeRecords instead. */
const ignoreRecords = (): void => undefined;

test("marks the page while the rows are on one line, and unmarks it after", () => {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  showOneLineRows(document, true);
  assert.equal(Object.hasOwn(document.documentElement.dataset, "fixAdoOneLine"), true);
  showOneLineRows(document, false);
  assert.equal(Object.hasOwn(document.documentElement.dataset, "fixAdoOneLine"), false);
});

test("writes nothing when the page already shows the right rows", () => {
  const { window } = new JSDOM("<!doctype html><body></body>");
  showOneLineRows(window.document, true);
  const observer = new window.MutationObserver(ignoreRecords);
  observer.observe(window.document.documentElement, { attributes: true });
  showOneLineRows(window.document, true);
  assert.deepEqual(observer.takeRecords(), []);
});
