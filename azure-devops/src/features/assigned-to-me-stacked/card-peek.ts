// Unfolds Azure DevOps's folded "Assigned to me" card for a moment, so the script can copy
// its tabs and a row to build the other cards, then folds it again. A folded card has no
// tabs, so the script knows it by the title it had when it was last open.
import {
  BUILT_CARD_CLASS,
  CARD_SELECTOR,
  CARD_TITLE_SELECTOR,
  PEEKING_CLASS,
  STACKED_CLASS,
} from "./assigned-card.ts";
import type { StackStatus } from "./stacked-tabs.ts";

const FOLD_BUTTON_SELECTOR = ".repos-pr-section-expand-button";
const CARD_CONTENT_SELECTOR = ".bolt-card-content";
/** How long Azure DevOps may take to unfold the card before the script folds it again and gives up. */
const PEEK_DEADLINE_MS = 5000;

/** Where the card's title is kept between page loads. */
interface CardTitleStore {
  get: () => string;
  set: (title: string) => void;
}

interface CardPeek {
  /**
   * After each show: folds a card it unfolded once its tabs are built, or unfolds the folded
   * card when what the built cards show is not `shownKey`, the pull requests to show.
   */
  sync: (document: Document, status: StackStatus, shownKey: string | null) => void;
}

const titleOf = (card: Element): string =>
  card.querySelector(CARD_TITLE_SELECTOR)?.textContent ?? "";

/** Azure DevOps's folded card with this title. */
function foldedCardTitled(document: Document, title: string): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>(
    `${CARD_SELECTOR}:not(.${BUILT_CARD_CLASS})`,
  );
  const folded = [...cards].find(
    (card) =>
      title !== "" && titleOf(card) === title && card.querySelector(CARD_CONTENT_SELECTOR) === null,
  );
  return folded ?? null;
}

function rememberTitle(document: Document, titles: CardTitleStore): void {
  const card = document.querySelector(`.${STACKED_CLASS}`);
  const title = card ? titleOf(card) : "";
  if (title !== "" && titles.get() !== title) {
    titles.set(title);
  }
}

function createCardPeek(now: () => number, titles: CardTitleStore): CardPeek {
  let peeking: { card: HTMLElement; startedAt: number } | null = null;
  let builtKey: string | null = null;

  function foldAgain(): void {
    peeking?.card.querySelector<HTMLElement>(FOLD_BUTTON_SELECTOR)?.click();
    peeking?.card.classList.remove(PEEKING_CLASS);
    peeking = null;
  }

  function unfold(document: Document): void {
    const card = foldedCardTitled(document, titles.get());
    if (card) {
      card.classList.add(PEEKING_CLASS);
      peeking = { card, startedAt: now() };
      card.querySelector<HTMLElement>(FOLD_BUTTON_SELECTOR)?.click();
    }
  }

  return {
    sync(document, status, shownKey) {
      if (status === "stacked") {
        rememberTitle(document, titles);
        builtKey = shownKey;
        if (peeking) {
          foldAgain();
        }
      } else if (peeking) {
        if (now() - peeking.startedAt > PEEK_DEADLINE_MS) {
          builtKey = shownKey;
          foldAgain();
        }
      } else if (shownKey !== null && shownKey !== builtKey) {
        unfold(document);
      }
    },
  };
}

export type { CardPeek, CardTitleStore };
export { createCardPeek };
