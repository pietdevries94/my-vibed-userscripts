import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import assert from "node:assert/strict";
import { createStarredReviewers } from "./starred-reviewers.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import { parsePullRequestHref } from "../../pull-requests/pull-request-link.ts";
import { test } from "node:test";

const PAGES = [
  "pr-detail-reviewers",
  "pr-detail-reviewers-add",
  "pr-detail-reviewers-search",
  "pr-detail-split-menu",
];
const ELSEWHERE: Identity = {
  displayName: "Marren Tolk",
  id: "id-marren",
  isGroup: false,
  signInAddress: "marren@example.com",
};

function reviewerRows(document: Document): Element[] {
  return [
    ...document.querySelectorAll(
      ".pr-required-reviewers-section > .repos-reviewer, .pr-optional-reviewers-section > .repos-reviewer",
    ),
  ];
}

/** The captured page with starred reviewers synced twice: the first row's reviewer and one elsewhere. */
function syncedPage(page: string): Document {
  const { document, pullRequestPath } = loadCapturedPullRequest(page);
  const firstName = reviewerRows(document)[0]?.querySelector(".flex-column > .body-m")?.textContent;
  assert.ok(firstName !== undefined && firstName !== null, "the capture has a reviewer row");
  let saved: unknown = [
    { displayName: firstName, id: "id-first", isGroup: false, signInAddress: "" },
    ELSEWHERE,
  ];
  const feature = createStarredReviewers({
    client: {
      addPullRequestReviewer: async (): Promise<void> => {
        await Promise.resolve();
      },
      getPullRequestReviewers: async () => [],
      searchIdentities: async () => [],
    },
    document,
    imageUrlOf: () => "",
    reload: (): void => undefined,
    schedule: () => (): void => undefined,
    store: createStarredReviewersStore({
      load: () => saved,
      save: (list) => {
        saved = list;
      },
    }),
  });
  const pullRequest = parsePullRequestHref(pullRequestPath, "/fake-org");
  feature.sync(pullRequest);
  feature.sync(pullRequest);
  return document;
}

for (const page of PAGES) {
  test(
    `the captured Overview (${page}) gets one starred section under Optional, and a star on each reviewer`,
    { skip: fixtures.skip },
    () => {
      const document = syncedPage(page);
      const sections = document.querySelectorAll(".fix-ado-starred-reviewers");
      assert.equal(sections.length, 1);
      assert.equal(
        sections[0]?.previousElementSibling,
        document.querySelector(".pr-optional-reviewers-section"),
      );
      const rows = reviewerRows(document);
      assert.ok(rows.length > 0);
      for (const row of rows) {
        const stars = row.querySelectorAll(":scope > .fix-ado-star");
        assert.equal(stars.length, 1);
        assert.match(stars[0]?.nextElementSibling?.className ?? "", /repos-reviewer-reveal/u);
      }
      assert.equal(rows[0]?.querySelector(".fix-ado-star")?.getAttribute("aria-pressed"), "true");
      const listed = [...document.querySelectorAll(".fix-ado-starred-reviewer .body-m")];
      assert.deepEqual(
        listed.map((name) => name.textContent),
        ["Marren Tolk"],
        "the starred reviewer on the pull request is not listed again",
      );
    },
  );
}
