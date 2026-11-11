import type { AdoClient } from "./ado-client.ts";
import type { WatchedPage } from "./page-reloader.ts";

const CARD_SELECTOR = ".wit-card[data-itemid]";

/** A work item on a board, from the work items REST API. */
export interface BoardWorkItem {
  id: number;
  /** Goes up by one with every change to the work item, a move on the board included. */
  rev: number;
  changedById: string | null;
}

export interface BoardSnapshot {
  workItems: Map<number, BoardWorkItem>;
  /** The signed-in user, or null when unknown. */
  myUserId: string | null;
}

export function isBoardLocation(location: { pathname: string }): boolean {
  return location.pathname.includes("/_boards/board/");
}

export function findBoardCardIds(root: ParentNode): number[] {
  const ids = new Set<number>();
  for (const card of root.querySelectorAll(CARD_SELECTOR)) {
    const id = Number(card.getAttribute("data-itemid"));
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

/**
 * True when someone else changed a card since the board loaded it. The user's
 * own changes do not count: the board already shows them.
 */
export function hasBoardChanged(loaded: BoardSnapshot, current: BoardSnapshot): boolean {
  for (const [id, workItem] of current.workItems) {
    const loadedWorkItem = loaded.workItems.get(id);
    if (!loadedWorkItem || loadedWorkItem.rev === workItem.rev) continue;
    const isMyOwnChange = current.myUserId !== null && workItem.changedById === current.myUserId;
    if (!isMyOwnChange) return true;
  }
  return false;
}

/**
 * Watches the cards on a board. A card that is new on the board is not
 * detected: only work items already on screen are compared.
 */
export function watchBoard(
  client: Pick<AdoClient, "getWorkItems" | "getAuthenticatedUserId">,
  location: { pathname: string; search: string },
  cardIds: number[],
): WatchedPage<BoardSnapshot> {
  return {
    key: `board:${location.pathname}${location.search}`,
    async fetchSnapshot() {
      const [{ workItems, retryAfterSeconds }, myUserId] = await Promise.all([
        client.getWorkItems(cardIds),
        client.getAuthenticatedUserId(),
      ]);
      return { snapshot: { workItems: new Map(workItems.map((workItem) => [workItem.id, workItem])), myUserId }, retryAfterSeconds };
    },
    hasChanged: hasBoardChanged,
    // Cards render as the user scrolls, and the user adds cards. Start comparing those too.
    extendLoaded: (loaded, current) => ({
      myUserId: current.myUserId,
      workItems: new Map([...current.workItems, ...loaded.workItems]),
    }),
  };
}
