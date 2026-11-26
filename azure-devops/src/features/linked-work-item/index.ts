import { findPullRequestRows, showLinkedWorkItem } from "../../pull-requests/pr-list.ts";
import {
  showGroupsLoading,
  showWorkItemColors,
  showWorkItemGroups,
} from "./work-item-group-rows.ts";
import type { ColoredList } from "./work-item-group-rows.ts";
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

/** Each row with its linked work items, or null while they are not fetched yet. */
function withLinkedWorkItems(
  rows: PullRequestRow[],
  fetcher: LinkedWorkItemFetcher,
): { row: HTMLElement; linked: LinkedWorkItems | null }[] {
  return rows.map(({ row, pullRequest }) => ({
    linked: fetcher.linkedWorkItems(pullRequest.pullRequestId),
    row,
  }));
}

/** Marks a row while its work items load, so the table shows a skeleton in their place. */
const LOADING_ATTRIBUTE = "data-fix-ado-work-item-loading";

/** Each row's work item id, or nothing in a grouped list, where the group's title has it. */
function showLinkedWorkItemLabels(
  rows: PullRequestRow[],
  fetcher: LinkedWorkItemFetcher,
  isGrouped: boolean,
): void {
  for (const { row, pullRequest } of rows) {
    const linked = isGrouped ? null : fetcher.linkedWorkItems(pullRequest.pullRequestId);
    showLinkedWorkItem(row, linked === null ? null : linkedWorkItemLabel(linked));
    const isLoading = !isGrouped && fetcher.isLoading(pullRequest.pullRequestId);
    if (row.hasAttribute(LOADING_ATTRIBUTE) !== isLoading) {
      row.toggleAttribute(LOADING_ATTRIBUTE, isLoading);
    }
  }
}

const linkedWorkItem: Feature = {
  change: { kind: "updated", version: "1.31.0" },
  description:
    "The work item id under the title, in a colour its pull requests share, and a switch that groups the lists by work item.",
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
      const colored: ColoredList[] = [];
      for (const list of document.querySelectorAll<HTMLElement>(LIST_SELECTOR)) {
        const rows = findRows(list);
        const groups = isList && isGrouped ? groupsOf(rows, fetcher) : null;
        showWorkItemGroups(list, basePath, groups);
        showGroupsLoading(list, isList && isGrouped && groups === null && rows.length > 0);
        showLinkedWorkItemLabels(rows, fetcher, groups !== null);
        colored.push({
          isGrouped: groups !== null,
          list,
          rows: isList ? withLinkedWorkItems(rows, fetcher) : [],
        });
      }
      showWorkItemColors(colored);
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
