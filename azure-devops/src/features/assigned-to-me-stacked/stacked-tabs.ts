// Shows the "Assigned to me" card's tabs under each other, and puts the card back as it was.
import type { AssignedCard, AssignedToMe, CardTab } from "./assigned-card.ts";
import {
  LIST_CLASS,
  STACKED_CLASS,
  TITLE_CLASS,
  createList,
  createTitle,
  findAssignedCard,
} from "./assigned-card.ts";
import type { AssignedPullRequest } from "./assigned-tabs.ts";
import type { RowContext } from "./assigned-row.ts";
import { pullRequestsOnTab } from "./assigned-tabs.ts";
import { relativeTime } from "./relative-time.ts";

/** Where the lists show, and when. */
type ShownContext = Omit<RowContext, "reviewerId">;

/** What a list shows. It is built again only when this changes. */
function shownKey(tab: CardTab, pullRequests: AssignedPullRequest[], now: number): string {
  return JSON.stringify([
    tab.label,
    pullRequests.map((pullRequest) => [
      pullRequest.pullRequestId,
      pullRequest.title,
      pullRequest.isDraft,
      pullRequest.mergeStatus,
      pullRequest.targetRefName,
      pullRequest.createdBy?.displayName,
      pullRequest.reviewers?.map(({ displayName, isRequired }) => [displayName, isRequired]),
      relativeTime(Date.parse(pullRequest.creationDate ?? ""), now),
    ]),
  ]);
}

function shownNode(card: HTMLElement, selector: string, key: string): HTMLElement | null {
  return (
    [...card.querySelectorAll<HTMLElement>(selector)].find(
      (node) => node.dataset.fixAdoShown === key,
    ) ?? null
  );
}

/** The title above Azure DevOps's own list, with the tab's own count. */
function selectedTitle(found: AssignedCard, tab: CardTab): HTMLElement {
  const key = JSON.stringify([tab.id, tab.label, tab.badge?.textContent]);
  const shown = shownNode(found.card, `:not(.${LIST_CLASS}) > .${TITLE_CLASS}`, key);
  if (shown) {
    return shown;
  }
  const title = createTitle(found.card.ownerDocument, tab, null);
  title.dataset.fixAdoShown = key;
  return title;
}

function builtList(
  found: AssignedCard,
  tab: CardTab,
  { assigned, context }: { assigned: AssignedToMe; context: ShownContext },
): HTMLElement[] {
  const pullRequests = pullRequestsOnTab(assigned.pullRequests, assigned.reviewerId, tab.id);
  if (pullRequests.length === 0) {
    return [];
  }
  const key = JSON.stringify([tab.id, shownKey(tab, pullRequests, context.now)]);
  const shown = shownNode(found.card, `.${LIST_CLASS}`, key);
  if (shown) {
    return [shown];
  }
  const list = createList(
    found,
    { pullRequests, tab },
    { ...context, reviewerId: assigned.reviewerId },
  );
  list.dataset.fixAdoShown = key;
  return [list];
}

/** Puts the nodes in order around Azure DevOps's list, which stays where it is. */
function placeAroundTable(table: HTMLElement, ordered: HTMLElement[]): void {
  const isInOrder = ordered.every(
    (node, index) => index === 0 || ordered[index - 1]?.nextElementSibling === node,
  );
  if (isInOrder) {
    return;
  }
  const tableIndex = ordered.indexOf(table);
  for (const node of ordered.slice(0, tableIndex)) {
    table.before(node);
  }
  let previous = table;
  for (const node of ordered.slice(tableIndex + 1)) {
    previous.after(node);
    previous = node;
  }
}

/** Takes out the script's titles and lists that are not in `kept`, and the card's mark. */
function removeStacking(root: ParentNode, kept: HTMLElement[]): void {
  for (const node of root.querySelectorAll<HTMLElement>(`.${LIST_CLASS}, .${TITLE_CLASS}`)) {
    if (!kept.includes(node) && !kept.some((keptNode) => keptNode.contains(node))) {
      node.remove();
    }
  }
  if (kept.length === 0) {
    for (const card of root.querySelectorAll(`.${STACKED_CLASS}`)) {
      card.classList.remove(STACKED_CLASS);
    }
  }
}

/**
 * Shows every tab of the "Assigned to me" card under each other, or with null puts the card
 * back. Only touches the DOM on a change.
 */
function showStackedTabs(
  document: Document,
  assigned: AssignedToMe | null,
  context: ShownContext,
): void {
  const found = findAssignedCard(document);
  if (found === null || assigned === null) {
    removeStacking(document, []);
    return;
  }
  const ordered = found.tabs.flatMap((tab) =>
    tab.isSelected
      ? [selectedTitle(found, tab), found.table]
      : builtList(found, tab, { assigned, context }),
  );
  removeStacking(found.card, ordered);
  placeAroundTable(found.table, ordered);
  if (!found.card.classList.contains(STACKED_CLASS)) {
    found.card.classList.add(STACKED_CLASS);
  }
}

export { showStackedTabs };
