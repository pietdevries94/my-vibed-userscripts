import { findPullRequestRows, showLinkedWorkItem } from "../../pull-requests/pr-list.ts";
import type { Feature } from "../../core/feature.ts";
import type { LinkedWorkItemFetcher } from "./linked-work-item-fetcher.ts";
import type { LinkedWorkItems } from "./linked-work-item.ts";
import type { PullRequestRow } from "../../pull-requests/pr-list.ts";
import type { WorkItemGroup } from "./work-item-groups.ts";
import { createLinkedWorkItemFetcher } from "./linked-work-item-fetcher.ts";
import { groupByWorkItem } from "./work-item-groups.ts";
import { linkedWorkItemLabel } from "./linked-work-item.ts";
import listSwitchStyle from "../../core/list-switch.css";
import { showListSwitch } from "../../core/list-switch.ts";
import { showWorkItemGroups } from "./work-item-group-rows.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

const IS_GROUPED_KEY = "linked-work-item-grouped";
const LIST_SELECTOR = "table.repos-pr-list > tbody";
const GROUP_SWITCH = { className: "fix-ado-group-toggle", label: "Group by work item" };

/** A list's groups, or null while one of its pull requests has no fetched work items yet. */
function groupsOf(
  rows: PullRequestRow[],
  fetcher: LinkedWorkItemFetcher,
): WorkItemGroup<HTMLElement>[] | null {
  const linkedRows: { row: HTMLElement; linked: LinkedWorkItems }[] = [];
  for (const { row, pullRequest } of rows) {
    const linked = fetcher.linkedWorkItems(pullRequest.pullRequestId);
    if (linked === null) {
      return null;
    }
    linkedRows.push({ linked, row });
  }
  return groupByWorkItem(linkedRows);
}

/** Each row's work item id, or nothing in a grouped list, where the group's title has it. */
function showLinkedWorkItemLabels(
  rows: PullRequestRow[],
  fetcher: LinkedWorkItemFetcher,
  isGrouped: boolean,
): void {
  for (const { row, pullRequest } of rows) {
    const linked = isGrouped ? null : fetcher.linkedWorkItems(pullRequest.pullRequestId);
    showLinkedWorkItem(row, linked === null ? null : linkedWorkItemLabel(linked));
  }
}

const linkedWorkItem: Feature = {
  change: { kind: "updated", version: "1.27.0" },
  description:
    "The id of the work item linked to each pull request in a list, under its title, with its title on hover. Multiple work items when there are more. A switch groups the lists by work item, each under its work item's id and title on a grey row.",
  id: "linked-work-item",
  name: "Linked work item",
  start({ basePath, client, document, now }) {
    const findRows = (root: ParentNode): PullRequestRow[] => findPullRequestRows(root, basePath);
    const fetcher = createLinkedWorkItemFetcher({
      client,
      findPullRequests: () => findRows(document).map(({ pullRequest }) => pullRequest),
      now,
    });
    let isGrouped = GM_getValue<boolean>(IS_GROUPED_KEY, false);
    let isList = false;

    function showAll(): void {
      for (const list of document.querySelectorAll<HTMLElement>(LIST_SELECTOR)) {
        const rows = findRows(list);
        const groups = isList && isGrouped ? groupsOf(rows, fetcher) : null;
        showWorkItemGroups(list, basePath, groups);
        showLinkedWorkItemLabels(rows, fetcher, groups !== null);
      }
      showListSwitch(
        document,
        GROUP_SWITCH,
        isList ? { isOn: isGrouped, onToggle: toggleGroups } : null,
      );
    }

    function toggleGroups(): void {
      isGrouped = !isGrouped;
      GM_setValue(IS_GROUPED_KEY, isGrouped);
      showAll();
    }

    return {
      sync({ page, isTabActive }) {
        isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox";
        showAll();
        if (isList && isTabActive) {
          void fetcher.sync().then(showAll);
        }
      },
    };
  },
  styles: [switchStyle, listSwitchStyle, style],
};

export { linkedWorkItem };
