import { findPullRequestRows, markRequiredReviewers, showPipelineStatus } from "./pr-list.ts";
import { JSDOM } from "jsdom";
import type { PullRequestRow } from "./pr-list.ts";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

function capturedPullRequestList(): PullRequestRow[] {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const list = buildFixtureDom(document, fixtures.read("pr-list-repository-pull-requests.html"));
  if (list === null) {
    throw new Error("the fixture has no root element");
  }
  document.body.append(list);
  return findPullRequestRows(document, "/fake-org");
}

function firstCapturedRow(): HTMLElement {
  const [first] = capturedPullRequestList();
  assert.ok(first !== undefined);
  return first.row;
}

const shownIcons = (row: HTMLElement): SVGElement[] => [
  ...row.querySelectorAll<SVGElement>(".fix-ado-pipeline-status"),
];

test("finds the captured pull request rows", { skip: fixtures.skip }, () => {
  assert.deepEqual(
    capturedPullRequestList().map(({ pullRequest }) => pullRequest),
    [
      { project: "project-1", pullRequestId: 1001, repository: "repo-1" },
      { project: "project-1", pullRequestId: 1012, repository: "repo-1" },
      { project: "project-1", pullRequestId: 1013, repository: "repo-1" },
    ],
  );
});

test("shows the icon right after the title", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "failed");

  const [icon] = shownIcons(row);
  assert.equal(icon?.dataset.status, "failed");
  assert.equal(icon?.getAttribute("aria-label"), "Pipeline failed");
  assert.ok(icon?.previousElementSibling?.classList.contains("body-l") === true);
  assert.ok(icon?.parentElement?.classList.contains("bolt-table-two-line-cell-item") === true);
});

test("showing the same status again leaves the icon alone", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "running");
  const [firstIcon] = shownIcons(row);
  showPipelineStatus(row, 1001, "running");
  assert.deepEqual(shownIcons(row), [firstIcon]);
});

test("a changed status replaces the icon", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "running");
  showPipelineStatus(row, 1001, "succeeded");
  assert.deepEqual(
    shownIcons(row).map((icon) => icon.dataset.status),
    ["succeeded"],
  );
});

test(
  "a row reused for another pull request gets that pull request's icon",
  { skip: fixtures.skip },
  () => {
    const row = firstCapturedRow();
    showPipelineStatus(row, 1001, "succeeded");
    showPipelineStatus(row, 2002, "succeeded");
    assert.deepEqual(
      shownIcons(row).map((icon) => icon.dataset.pullRequestId),
      ["2002"],
    );
  },
);

test("no status removes the icon", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "succeeded");
  showPipelineStatus(row, 1001, null);
  assert.deepEqual(shownIcons(row), []);
});

interface RowWithReviewers {
  required: () => boolean[];
  reviewerElements: HTMLElement[];
  row: HTMLElement;
}

function firstRowWithReviewers(names: string[]): RowWithReviewers {
  const row = firstCapturedRow();
  const reviewerElements = [...row.querySelectorAll<HTMLElement>(".pr-reviewer")];
  assert.equal(reviewerElements.length, 3, "the captured first row has three reviewers");
  for (const [index, element] of reviewerElements.entries()) {
    element.querySelector(".bolt-coin")?.setAttribute("aria-label", names[index] ?? "");
  }
  const required = (): boolean[] =>
    reviewerElements.map((element) => Object.hasOwn(element.dataset, "fixAdoRequired"));
  return { required, reviewerElements, row };
}

const REVIEWERS = [
  { displayName: "Holt, Mira", id: "1" },
  { displayName: "Elst, Tomas van", id: "2", isRequired: true },
  { displayName: String.raw`[Project]\Backend Team`, id: "3", isRequired: true },
];

test("required reviewers are marked", { skip: fixtures.skip }, () => {
  const { row, reviewerElements, required } = firstRowWithReviewers([
    "Holt, Mira",
    "Elst, Tomas van",
    "Backend Team",
  ]);
  markRequiredReviewers(row, REVIEWERS);
  assert.deepEqual(required(), [false, true, true]);
  assert.ok(reviewerElements[0]?.parentElement?.dataset.fixAdoReviewers !== undefined);
});

test("a reviewer that is not in the list is not marked", { skip: fixtures.skip }, () => {
  const { row, required } = firstRowWithReviewers(["Holt, Mira", "Unknown Person", "Backend Team"]);
  markRequiredReviewers(row, REVIEWERS);
  assert.deepEqual(required(), [false, false, true]);
});

test("a row reused for another pull request loses the old marks", { skip: fixtures.skip }, () => {
  const { row, required } = firstRowWithReviewers([
    "Holt, Mira",
    "Elst, Tomas van",
    "Backend Team",
  ]);
  markRequiredReviewers(row, REVIEWERS);
  markRequiredReviewers(row, [{ displayName: "Holt, Mira", id: "1", isRequired: true }]);
  assert.deepEqual(required(), [true, false, false]);
});
