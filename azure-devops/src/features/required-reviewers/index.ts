import type { Feature } from "../../core/feature.ts";
import type { Page } from "../../core/page.ts";
import { createRequiredReviewerMarker } from "../../required-reviewers.ts";
import { findPullRequestRows } from "../../pr-list.ts";

const requiredReviewers: Feature = {
  description: "Required reviewers come first in pull request lists, with a glow.",
  id: "required-reviewers",
  name: "Required reviewers first",
  start({ basePath, client, document, now }) {
    let shownPage: Page = { kind: "other" };
    const marker = createRequiredReviewerMarker({
      client,
      findRows: () => findPullRequestRows(document, basePath),
      listStatus: () =>
        shownPage.kind === "pull-request-list" ? shownPage.listPage.status : "active",
      now,
    });
    return {
      sync({ page, isTabActive }) {
        shownPage = page;
        marker.markAll();
        const isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox";
        if (isList && isTabActive) {
          void marker.sync();
        }
      },
    };
  },
};

export { requiredReviewers };
