import { findPullRequestRows, markRequiredReviewers, showPipelineStatus } from "./pr-list.ts";
import { JSDOM } from "jsdom";
import type { PullRequestRow } from "./pr-list.ts";
import type { Reviewer } from "./reviewers.ts";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

interface CapturedList {
  data: { pullRequests: { pullRequestId: number; reviewers?: Reviewer[] }[] };
}

/** The rows of a captured page: "pr-list" or "pr-inbox". */
function capturedRows(page: string): PullRequestRow[] {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const root = buildFixtureDom(document, fixtures.read(`${page}.html`));
  if (root === null) {
    throw new Error("the fixture has no root element");
  }
  document.body.append(root);
  return findPullRequestRows(document, "/fake-org");
}

function capturedRow(page: string, pullRequestId: number): HTMLElement {
  const found = capturedRows(page).find(
    ({ pullRequest }) => pullRequest.pullRequestId === pullRequestId,
  );
  assert.ok(found !== undefined, `${page} has a row for ${pullRequestId}`);
  return found.row;
}

/** The reviewers the repository list fetched for a pull request. */
function capturedReviewers(pullRequestId: number): Reviewer[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the capture writes this shape
  const { data } = JSON.parse(fixtures.read("pr-list.json")) as CapturedList;
  const listed = data.pullRequests.find(
    (pullRequest) => pullRequest.pullRequestId === pullRequestId,
  );
  return listed?.reviewers ?? [];
}

const shownIcons = (row: HTMLElement): SVGElement[] => [
  ...row.querySelectorAll<SVGElement>(".fix-ado-pipeline-status"),
];

test("finds the rows of the captured repository list", { skip: fixtures.skip }, () => {
  assert.deepEqual(
    capturedRows("pr-list").map(({ pullRequest }) => pullRequest),
    [
      { project: "text-2", pullRequestId: 1001, repository: "text-6" },
      { project: "text-2", pullRequestId: 1002, repository: "text-6" },
    ],
  );
});

test("finds the rows of the captured inbox, across repositories", { skip: fixtures.skip }, () => {
  assert.deepEqual(
    capturedRows("pr-inbox").map(({ pullRequest }) => pullRequest),
    [
      { project: "text-2", pullRequestId: 1001, repository: "text-6" },
      { project: "text-2", pullRequestId: 1002, repository: "text-23" },
      { project: "text-2", pullRequestId: 1003, repository: "text-23" },
    ],
  );
});

for (const page of ["pr-list", "pr-inbox"]) {
  test(`${page}: shows the icon right after the title`, { skip: fixtures.skip }, () => {
    const row = capturedRow(page, 1001);
    showPipelineStatus(row, 1001, "failed");

    const [icon] = shownIcons(row);
    assert.equal(icon?.dataset.status, "failed");
    assert.equal(icon?.getAttribute("aria-label"), "Pipeline failed");
    assert.ok(icon?.previousElementSibling?.classList.contains("body-l") === true);
    assert.ok(icon?.parentElement?.classList.contains("bolt-table-two-line-cell-item") === true);
  });
}

test("showing the same status again leaves the icon alone", { skip: fixtures.skip }, () => {
  const row = capturedRow("pr-list", 1001);
  showPipelineStatus(row, 1001, "running");
  const [firstIcon] = shownIcons(row);
  showPipelineStatus(row, 1001, "running");
  assert.deepEqual(shownIcons(row), [firstIcon]);
});

test("a changed status replaces the icon", { skip: fixtures.skip }, () => {
  const row = capturedRow("pr-list", 1001);
  showPipelineStatus(row, 1001, "running");
  showPipelineStatus(row, 1001, "succeeded");
  assert.deepEqual(
    shownIcons(row).map((icon) => icon.dataset.status),
    ["succeeded"],
  );
});

test(
  "a row reused for another pull request gets that pull request's icon",
  {
    skip: fixtures.skip,
  },
  () => {
    const row = capturedRow("pr-list", 1001);
    showPipelineStatus(row, 1001, "succeeded");
    showPipelineStatus(row, 2002, "succeeded");
    assert.deepEqual(
      shownIcons(row).map((icon) => icon.dataset.pullRequestId),
      ["2002"],
    );
  },
);

test("no status removes the icon", { skip: fixtures.skip }, () => {
  const row = capturedRow("pr-list", 1001);
  showPipelineStatus(row, 1001, "succeeded");
  showPipelineStatus(row, 1001, null);
  assert.deepEqual(shownIcons(row), []);
});

/** The captured row with three reviewers, and which of its reviewers are marked required. */
function rowWithReviewers(): { row: HTMLElement; required: () => boolean[] } {
  const row = capturedRow("pr-list", 1002);
  const reviewerElements = [...row.querySelectorAll<HTMLElement>(".pr-reviewer")];
  assert.equal(reviewerElements.length, 3, "the captured row has three reviewers");
  const required = (): boolean[] =>
    reviewerElements.map((element) => Object.hasOwn(element.dataset, "fixAdoRequired"));
  return { required, row };
}

/** The captured reviewers of the row, read fresh, with the ones at `requiredIndexes` made required. */
function reviewersRequiredAt(requiredIndexes: number[]): Reviewer[] {
  const reviewers = capturedReviewers(1002);
  assert.equal(reviewers.length, 3);
  for (const [index, reviewer] of reviewers.entries()) {
    reviewer.isRequired = requiredIndexes.includes(index);
  }
  return reviewers;
}

test("the captured reviewers are all optional, and none is marked", { skip: fixtures.skip }, () => {
  const { row, required } = rowWithReviewers();
  markRequiredReviewers(row, capturedReviewers(1002));
  assert.deepEqual(required(), [false, false, false]);
});

test("required reviewers are marked", { skip: fixtures.skip }, () => {
  const { row, required } = rowWithReviewers();
  markRequiredReviewers(row, reviewersRequiredAt([1, 2]));
  assert.deepEqual(required(), [false, true, true]);
});

test("a reviewer that is not in the list is not marked", { skip: fixtures.skip }, () => {
  const { row, required } = rowWithReviewers();
  const [first, , third] = reviewersRequiredAt([0, 1, 2]);
  assert.ok(first !== undefined && third !== undefined);
  markRequiredReviewers(row, [first, third]);
  assert.deepEqual(required(), [true, false, true]);
});

test("a row reused for another pull request loses the old marks", { skip: fixtures.skip }, () => {
  const { row, required } = rowWithReviewers();
  markRequiredReviewers(row, reviewersRequiredAt([1, 2]));
  markRequiredReviewers(row, reviewersRequiredAt([0]));
  assert.deepEqual(required(), [true, false, false]);
});
