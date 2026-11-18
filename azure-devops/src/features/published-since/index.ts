import {
  findPullRequestRows,
  isDraftRow,
  showPublishedSince,
} from "../../pull-requests/pr-list.ts";
import type { Feature } from "../../core/feature.ts";
import type { PullRequestRow } from "../../pull-requests/pr-list.ts";
import { createPublishedAtFetcher } from "./published-at-fetcher.ts";
import { publishedSinceText } from "./published-since.ts";
import style from "./style.css";

type PullRequestRowWithDraft = PullRequestRow & { isDraft: boolean };

const publishedSince: Feature = {
  change: { kind: "new", version: "1.16.0" },
  description: "A column on each pull request in a list with how long ago it left draft.",
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

    function showAll(): void {
      for (const { row, pullRequest, isDraft } of findRows()) {
        const at = isDraft ? null : fetcher.publishedAt(pullRequest.pullRequestId);
        showPublishedSince(row, at === null ? null : publishedSinceText(at, now()));
      }
    }

    return {
      sync({ page, isTabActive }) {
        showAll();
        const isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox";
        if (isList && isTabActive) {
          void fetcher.sync().then(showAll);
        }
      },
    };
  },
  styles: [style],
};

export { publishedSince };
