import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { isOwnerBusy } from "./reload-when-idle.ts";
import { test } from "node:test";

function documentWith(body: string): Document {
  return new JSDOM(`<!doctype html><body>${body}</body>`).window.document;
}

test("an open native dialog keeps the page from reloading", () => {
  assert.equal(isOwnerBusy(documentWith("<dialog open><button>Save</button></dialog>")), true);
});

test("a dialog marked with the dialog role keeps the page from reloading", () => {
  assert.equal(isOwnerBusy(documentWith('<div role="dialog">A work item</div>')), true);
});

test("a closed native dialog lets the page reload", () => {
  assert.equal(isOwnerBusy(documentWith("<dialog><button>Save</button></dialog>")), false);
});

function documentWithFocusOn(body: string): Document {
  const document = documentWith(body);
  document.querySelector<HTMLElement>("#focused")?.focus();
  return document;
}

test("focus in a text field or editor keeps the page from reloading", () => {
  assert.equal(isOwnerBusy(documentWithFocusOn('<input id="focused">')), true);
  assert.equal(isOwnerBusy(documentWithFocusOn('<textarea id="focused"></textarea>')), true);
});

test("focus on a checkbox or a button that is an input lets the page reload", () => {
  assert.equal(isOwnerBusy(documentWithFocusOn('<input id="focused" type="checkbox">')), false);
  assert.equal(isOwnerBusy(documentWithFocusOn('<input id="focused" type="button">')), false);
});
