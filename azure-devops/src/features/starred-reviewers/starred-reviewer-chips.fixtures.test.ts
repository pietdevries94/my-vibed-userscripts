import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../../shared/dev/fake-site/fixture-dom.ts";
import { createStarredReviewerChips } from "./starred-reviewer-chips.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import { scriptFixtures } from "../../../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);
const OPTIONAL_LABEL = "__bolt-pr-optional-reviewers-label";
const REQUIRED_LABEL = "__bolt-pr-required-reviewers-label";
const ELSEWHERE: Identity = {
  displayName: "Marren Tolk",
  id: "id-marren",
  isGroup: false,
  signInAddress: "marren@example.com",
};

function loadCapturedPage(page: string): Document {
  const html = fixtures
    .read(`${page}.html`)
    .replace(/^<body\b/u, "<div")
    .replace(/<\/body>\s*$/u, "</div>");
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const root = buildFixtureDom(document, html);
  assert.ok(root);
  document.body.append(root);
  return document;
}

/** The captured page with chips synced twice: the reviewer already in a field, and one elsewhere. */
function syncedPage(page: string): Document {
  const document = loadCapturedPage(page);
  const inField = document.querySelector(
    ".bolt-identity-picker-pill .bolt-pill-content",
  )?.textContent;
  let saved: unknown = [
    ...(inField === null || inField === undefined
      ? []
      : [{ displayName: inField, id: "id-in-field", isGroup: false, signInAddress: "" }]),
    ELSEWHERE,
  ];
  const chips = createStarredReviewerChips({
    document,
    imageUrlOf: () => "",
    onNextDomChange: () => (): void => undefined,
    schedule: () => (): void => undefined,
    store: createStarredReviewersStore({
      load: () => saved,
      save: (list) => {
        saved = list;
      },
    }),
  });
  chips.sync(true);
  chips.sync(true);
  return document;
}

function chipNamesUnder(document: Document, labelId: string): string[] {
  const column = document.querySelector(`#${labelId}`)?.parentElement?.parentElement;
  return [
    ...(column?.querySelectorAll(":scope > .fix-ado-starred-chips .bolt-pill-content") ?? []),
  ].map((name) => name.textContent ?? "");
}

for (const page of [
  "pr-create-with-branch-selected",
  "pr-create-reviewers-search",
  "pr-create-reviewer-added",
]) {
  test(
    `the captured create page (${page}) gets one chip row under Reviewers`,
    { skip: fixtures.skip },
    () => {
      const document = syncedPage(page);
      assert.equal(document.querySelectorAll(".fix-ado-starred-chips").length, 1);
      assert.deepEqual(chipNamesUnder(document, OPTIONAL_LABEL), ["Marren Tolk"]);
    },
  );
}

test(
  "the captured create page with required reviewers on gets a chip row under each field",
  { skip: fixtures.skip },
  () => {
    const document = syncedPage("pr-create-reviewer-added-with-required-enabled");
    assert.equal(document.querySelectorAll(".fix-ado-starred-chips").length, 2);
    assert.deepEqual(chipNamesUnder(document, OPTIONAL_LABEL), ["Marren Tolk"]);
    assert.deepEqual(chipNamesUnder(document, REQUIRED_LABEL), ["Marren Tolk"]);
  },
);

test(
  "the captured create page before a branch is picked has no reviewer field, so no chips",
  { skip: fixtures.skip },
  () => {
    assert.equal(syncedPage("pr-create").querySelectorAll(".fix-ado-starred-chips").length, 0);
  },
);
