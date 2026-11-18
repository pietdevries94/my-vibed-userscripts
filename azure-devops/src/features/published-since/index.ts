import {
  findPullRequestRows,
  isDraftRow,
  showPublishedSince,
} from "../../pull-requests/pr-list.ts";
import {
  isPublishedTooLongAgo,
  publishedSinceText,
  showsPublishedSince,
} from "./published-since.ts";
import type { Feature } from "../../core/feature.ts";
import type { PullRequestRow } from "../../pull-requests/pr-list.ts";
import { createPublishedAtFetcher } from "./published-at-fetcher.ts";
import style from "./style.css";

type PullRequestRowWithDraft = PullRequestRow & { isDraft: boolean };

const publishedSince: Feature = {
  change: { kind: "updated", version: "1.17.0" },
  description:
    "How long ago each active pull request in a list left draft, under its update time. Red after two weekdays.",
  id: "published-since",
  name: "Published since",
  start({ basePath, client, document, now }) {
    const findRows = (): PullRequestRowWithDraft[] =>
      findPullRequestRows(document, basePath).map(({ row, pullRequest }) => ({
        isDraft: isDraftRow(row),
        pullRequest,
        row,
      }));
    const fetcher = createPublishedAtFetcher({ client, findRows, now });

    function showAll(isShown: boolean): void {
      for (const { row, pullRequest, isDraft } of findRows()) {
        const at = isShown && !isDraft ? fetcher.publishedAt(pullRequest.pullRequestId) : null;
        showPublishedSince(
          row,
          at === null
            ? null
            : {
                isTooLongAgo: isPublishedTooLongAgo(at, now()),
                text: publishedSinceText(at, now()),
              },
        );
      }
    }

    return {
      sync({ page, isTabActive }) {
        const isShown = showsPublishedSince(page);
        showAll(isShown);
        if (isShown && isTabActive) {
          void fetcher.sync().then(() => {
            showAll(isShown);
          });
        }
      },
    };
  },
  styles: [style],
};

export { publishedSince };
