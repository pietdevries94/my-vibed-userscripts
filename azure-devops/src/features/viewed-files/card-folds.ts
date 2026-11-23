// The fold of each file card. A viewed file's card starts collapsed, and a header
// button's click also reaches the cards Azure DevOps loads later, on a scroll.
import { fileCards, setCardOpen } from "./viewed-toggles.ts";
import type { ShownPullRequest } from "./tree-ticks.ts";

/** Collapses the card of each viewed file once, the first time the script knows its tick. */
function foldViewedCards(document: Document, shown: ShownPullRequest): void {
  for (const { card, path } of fileCards(document)) {
    const tick = shown.fileTicks.get(path);
    if (tick !== undefined && !shown.cardsFolded.has(path)) {
      shown.cardsFolded.add(path);
      if (tick) {
        setCardOpen(card, false);
      }
    }
  }
}

/** Gives each drawn card the state a header button asked for it, once. */
function setAskedCards(document: Document, shown: ShownPullRequest): void {
  for (const { card, path } of fileCards(document)) {
    const isOpen = shown.cardsAsked.get(path);
    if (isOpen !== undefined) {
      shown.cardsAsked.delete(path);
      setCardOpen(card, isOpen);
    }
  }
}

/** Opens or collapses the cards of these files: now when drawn, else when Azure DevOps loads them. */
function askCards(
  document: Document,
  shown: ShownPullRequest,
  ask: { paths: string[]; isOpen: boolean },
): void {
  for (const path of ask.paths) {
    shown.cardsAsked.set(path, ask.isOpen);
    shown.cardsFolded.add(path);
  }
  setAskedCards(document, shown);
}

export { askCards, foldViewedCards, setAskedCards };
