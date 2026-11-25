// Folds a built "Assigned to me" card with the fold button it copied from Azure DevOps's card.
// Each card folds on its own, and stays folded when the script builds it again.
import { showFoldToggleState } from "../../core/fold-toggle.ts";

const FOLDED_CLASS = "fix-ado-assigned-folded";
const FOLD_BUTTON_SELECTOR = ".repos-pr-section-expand-button";

/** Which tabs' cards are folded, and what a click on a card's fold button does. */
interface CardFolding {
  foldedTabIds: ReadonlySet<string>;
  onToggle: (tabId: string) => void;
}

/** Makes the button fold the tab's card, once per button. */
function listenToFoldButton(button: HTMLButtonElement, tabId: string, folding: CardFolding): void {
  if (button.dataset.fixAdoFoldTab === tabId) {
    return;
  }
  button.dataset.fixAdoFoldTab = tabId;
  button.addEventListener("click", () => {
    folding.onToggle(tabId);
  });
}

/** Shows the card open or folded, and makes its fold button work. Only touches the DOM on a change. */
function showCardFolding(card: HTMLElement, tabId: string, folding: CardFolding): void {
  const isFolded = folding.foldedTabIds.has(tabId);
  if (card.classList.contains(FOLDED_CLASS) !== isFolded) {
    card.classList.toggle(FOLDED_CLASS, isFolded);
  }
  const button = card.querySelector<HTMLButtonElement>(FOLD_BUTTON_SELECTOR);
  if (button === null) {
    return;
  }
  listenToFoldButton(button, tabId, folding);
  const name = button.getAttribute("aria-label") ?? "";
  showFoldToggleState(button, !isFolded, { folded: name, name, open: name });
}

export type { CardFolding };
export { showCardFolding };
