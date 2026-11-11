import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { buildFixtureDom } from "../../shared/dev/fake-site/fixture-dom.ts";
import { scriptFixtures } from "../../shared/dev/fixtures.ts";
import { findPullRequestRows, markRequiredReviewers, showPipelineStatus } from "./pr-list.ts";

const fixtures = scriptFixtures(import.meta.dirname);

function capturedPullRequestList() {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  document.body.append(buildFixtureDom(document, fixtures.read("pr-list-repository-pull-requests.html"))!);
  return findPullRequestRows(document, "/fake-org");
}

function firstCapturedRow(): HTMLElement {
  const [first] = capturedPullRequestList();
  assert.ok(first);
  return first.row;
}

const shownIcons = (row: HTMLElement) => [...row.querySelectorAll<SVGElement>(".fix-ado-pipeline-status")];

test("finds the captured pull request rows", { skip: fixtures.skip }, () => {
  assert.deepEqual(capturedPullRequestList().map(({ pullRequest }) => pullRequest), [
    { project: "project-1", repository: "repo-1", pullRequestId: 1001 },
    { project: "project-1", repository: "repo-1", pullRequestId: 1012 },
    { project: "project-1", repository: "repo-1", pullRequestId: 1013 },
  ]);
});

test("shows the icon right after the title", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "failed");

  const [icon] = shownIcons(row);
  assert.equal(icon?.dataset.status, "failed");
  assert.equal(icon?.getAttribute("aria-label"), "Pipeline failed");
  assert.ok(icon?.previousElementSibling?.classList.contains("body-l"));
  assert.ok(icon?.parentElement?.classList.contains("bolt-table-two-line-cell-item"));
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
  assert.deepEqual(shownIcons(row).map((icon) => icon.dataset.status), ["succeeded"]);
});

test("a row reused for another pull request gets that pull request's icon", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "succeeded");
  showPipelineStatus(row, 2002, "succeeded");
  assert.deepEqual(shownIcons(row).map((icon) => icon.dataset.pullRequestId), ["2002"]);
});

test("no status removes the icon", { skip: fixtures.skip }, () => {
  const row = firstCapturedRow();
  showPipelineStatus(row, 1001, "succeeded");
  showPipelineStatus(row, 1001, null);
  assert.deepEqual(shownIcons(row), []);
});

function firstRowWithReviewers(names: string[]) {
  const row = firstCapturedRow();
  const reviewerElements = [...row.querySelectorAll<HTMLElement>(".pr-reviewer")];
  assert.equal(reviewerElements.length, 3, "the captured first row has three reviewers");
  reviewerElements.forEach((element, index) => {
    element.querySelector(".bolt-coin")?.setAttribute("aria-label", names[index] ?? "");
  });
  const required = () => reviewerElements.map((element) => element.hasAttribute("data-fix-ado-required"));
  return { row, reviewerElements, required };
}

const REVIEWERS = [
  { id: "1", displayName: "Holt, Mira" },
  { id: "2", displayName: "Elst, Tomas van", isRequired: true },
  { id: "3", displayName: "[Project]\\Backend Team", isRequired: true },
];

test("required reviewers are marked", { skip: fixtures.skip }, () => {
  const { row, reviewerElements, required } = firstRowWithReviewers(["Holt, Mira", "Elst, Tomas van", "Backend Team"]);
  markRequiredReviewers(row, REVIEWERS);
  assert.deepEqual(required(), [false, true, true]);
  assert.ok(reviewerElements[0]?.parentElement?.hasAttribute("data-fix-ado-reviewers"));
});

test("a reviewer that is not in the list is not marked", { skip: fixtures.skip }, () => {
  const { row, required } = firstRowWithReviewers(["Holt, Mira", "Unknown Person", "Backend Team"]);
  markRequiredReviewers(row, REVIEWERS);
  assert.deepEqual(required(), [false, false, true]);
});

test("a row reused for another pull request loses the old marks", { skip: fixtures.skip }, () => {
  const { row, required } = firstRowWithReviewers(["Holt, Mira", "Elst, Tomas van", "Backend Team"]);
  markRequiredReviewers(row, REVIEWERS);
  markRequiredReviewers(row, [{ id: "1", displayName: "Holt, Mira", isRequired: true }]);
  assert.deepEqual(required(), [true, false, false]);
});
