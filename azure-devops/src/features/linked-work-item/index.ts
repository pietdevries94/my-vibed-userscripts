import { findPullRequestRows, showLinkedWorkItem } from "../../pull-requests/pr-list.ts";
import type { Feature } from "../../core/feature.ts";
import type { PullRequestRow } from "../../pull-requests/pr-list.ts";
import { createLinkedWorkItemFetcher } from "./linked-work-item-fetcher.ts";
import { linkedWorkItemText } from "./linked-work-item.ts";
import style from "./style.css";

const linkedWorkItem: Feature = {
  change: { kind: "new", version: "1.20.0" },
  description:
    "The work item linked to each pull request in a list, under its title. Multiple work items when there are more.",
  id: "linked-work-item",
  name: "Linked work item",
  start({ basePath, client, document, now }) {
    const findRows = (): PullRequestRow[] => findPullRequestRows(document, basePath);
    const fetcher = createLinkedWorkItemFetcher({
      client,
      findPullRequests: () => findRows().map(({ pullRequest }) => pullRequest),
      now,
    });

    function showAll(): void {
      for (const { row, pullRequest } of findRows()) {
        const linked = fetcher.linkedWorkItems(pullRequest.pullRequestId);
        showLinkedWorkItem(row, linked === null ? null : linkedWorkItemText(linked));
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

export { linkedWorkItem };
