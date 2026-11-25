// Shows each tab of the "Assigned to me" card as a card of its own, under each other, and
// puts the page back as it was.
import type { AssignedCard, AssignedToMe, CardTab, TabList } from "./assigned-card.ts";
import {
  BUILT_CARD_CLASS,
  STACKED_CLASS,
  TAB_NAME_CLASS,
  createCard,
  findAssignedCard,
  showTabName,
  shownTabName,
  tabNameOf,
} from "./assigned-card.ts";
import type { AssignedPullRequest } from "./assigned-tabs.ts";
import type { CardFolding } from "./card-folding.ts";
import type { RowContext } from "./assigned-row.ts";
import { pullRequestsOnTab } from "./assigned-tabs.ts";
import { relativeTime } from "./relative-time.ts";
import { showCardFolding } from "./card-folding.ts";

/** Whether the card shows its tabs as cards, is folded with them kept, or shows none. */
type StackStatus = "stacked" | "folded" | "none";

/** Where the cards show, and when. */
type ShownContext = Omit<RowContext, "reviewerId"> & { folding: CardFolding };

/** What a built card shows. It is built again only when this changes. */
function shownKey(tab: CardTab, pullRequests: AssignedPullRequest[], now: number): string {
  return JSON.stringify([
    tab.id,
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

function shownCard(document: Document, key: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(`.${BUILT_CARD_CLASS}`)].find(
    (card) => card.dataset.fixAdoShown === key,
  );
}

/** A new card for the tab, keyed with what it shows. */
function createKeyedCard(
  found: AssignedCard,
  { key, ...tabList }: TabList & { key: string },
  context: RowContext,
): HTMLElement | null {
  const card = createCard(found, tabList, context);
  if (card) {
    card.dataset.fixAdoShown = key;
  }
  return card;
}

function builtCard(
  found: AssignedCard,
  tab: CardTab,
  { assigned, context }: { assigned: AssignedToMe; context: ShownContext },
): HTMLElement[] {
  const pullRequests = pullRequestsOnTab(assigned.pullRequests, assigned.reviewerId, tab.id);
  if (pullRequests.length === 0) {
    return [];
  }
  const key = shownKey(tab, pullRequests, context.now);
  const card =
    shownCard(found.card.ownerDocument, key) ??
    createKeyedCard(
      found,
      { key, pullRequests, tab },
      { ...context, reviewerId: assigned.reviewerId },
    );
  if (card) {
    showCardFolding(card, tab.id, context.folding);
  }
  return card ? [card] : [];
}

/** Puts the cards in order around Azure DevOps's card, which stays where it is. */
function placeAround(adoCard: HTMLElement, ordered: HTMLElement[]): void {
  const isInOrder = ordered.every(
    (node, index) => index === 0 || ordered[index - 1]?.nextElementSibling === node,
  );
  if (isInOrder) {
    return;
  }
  const adoIndex = ordered.indexOf(adoCard);
  for (const node of ordered.slice(0, adoIndex)) {
    adoCard.before(node);
  }
  let previous = adoCard;
  for (const node of ordered.slice(adoIndex + 1)) {
    previous.after(node);
    previous = node;
  }
}

/** Takes out the built cards that are not in `kept`, and with none kept, the card's mark. */
function removeStacking(document: Document, kept: HTMLElement[]): void {
  for (const card of document.querySelectorAll<HTMLElement>(`.${BUILT_CARD_CLASS}`)) {
    if (!kept.includes(card)) {
      card.remove();
    }
  }
  if (kept.length === 0) {
    for (const card of document.querySelectorAll<HTMLElement>(`.${STACKED_CLASS}`)) {
      card.querySelector(`.${TAB_NAME_CLASS}`)?.remove();
      card.classList.remove(STACKED_CLASS);
      delete card.dataset.fixAdoTabName;
    }
  }
}

/** Marks Azure DevOps's card, which hides its tabs, and names its selected tab after its title. */
function markAsStacked({ card, tabs }: AssignedCard): void {
  const selected = tabs.find(({ isSelected }) => isSelected);
  if (selected) {
    showTabName(card, tabNameOf(selected.element));
  }
  if (!card.classList.contains(STACKED_CLASS)) {
    card.classList.add(STACKED_CLASS);
  }
}

/**
 * A folded card has no list or tabs: its built cards stay as they are, and its title keeps
 * the name of its tab. Without a card the page goes back as it was.
 */
function showFoldedCard(document: Document, assigned: AssignedToMe | null): StackStatus {
  const folded = document.querySelector<HTMLElement>(`.${STACKED_CLASS}`);
  const tabName = folded ? shownTabName(folded) : null;
  if (assigned === null || folded === null || tabName === null) {
    removeStacking(document, []);
    return "none";
  }
  showTabName(folded, tabName);
  return "folded";
}

/**
 * Shows every tab of the "Assigned to me" card as a card of its own, or with null puts the
 * page back. Only touches the DOM on a change.
 */
function showStackedTabs(
  document: Document,
  assigned: AssignedToMe | null,
  context: ShownContext,
): StackStatus {
  const found = findAssignedCard(document);
  if (found === null || assigned === null) {
    return showFoldedCard(document, assigned);
  }
  const ordered = found.tabs.flatMap((tab) =>
    tab.isSelected ? [found.card] : builtCard(found, tab, { assigned, context }),
  );
  removeStacking(document, ordered);
  placeAround(found.card, ordered);
  markAsStacked(found);
  return "stacked";
}

export type { StackStatus };
export { showStackedTabs };
