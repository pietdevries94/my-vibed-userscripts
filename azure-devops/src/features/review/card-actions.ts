// What the buttons and the text box of a pending comment's card do. An edit is kept
// as a draft for as long as the page stays open: the owner can go to another file or
// tab and come back to it. Only "Update comment" saves it.
import { ID_ATTRIBUTE, cardAround } from "./pending-card.ts";
import type { PendingComment, ReviewStore } from "./review-store.ts";
import type { ClickedAction } from "./review-markup.ts";
import { closestElement } from "../../core/closest-element.ts";

/** The unsaved edits by comment id. */
type Drafts = Map<string, string>;

interface CardContext {
  store: ReviewStore;
  /** The storage key of the review on the page. */
  key: string;
  drafts: Drafts;
}

/** Saves every draft with text as its comment's content, and forgets all drafts. */
function saveDrafts({ drafts, key, store }: CardContext): void {
  for (const [id, draft] of drafts) {
    if (draft.trim() !== "") {
      store.change(key, id, { content: draft.trim() });
    }
  }
  drafts.clear();
}

/** What each button of a card does to its comment. */
const CARD_ACTIONS: Record<string, (context: CardContext, comment: PendingComment) => void> = {
  "cancel-edit": ({ drafts }, { id }) => {
    drafts.delete(id);
  },
  edit: ({ drafts }, { content, id }) => {
    drafts.set(id, drafts.get(id) ?? content);
  },
  remove: ({ drafts, key, store }, { id }) => {
    store.remove(key, id);
    drafts.delete(id);
  },
  update: ({ drafts, key, store }, { id }) => {
    const draft = drafts.get(id)?.trim() ?? "";
    // An edit without text stays open: a comment cannot be empty.
    if (draft !== "") {
      store.change(key, id, { content: draft });
      drafts.delete(id);
    }
  },
};

/** A click on a card's button. Returns the id of the comment whose edit it starts, or null. */
function handleCardAction(context: CardContext, { action, button }: ClickedAction): string | null {
  const id = cardAround(button)?.id ?? null;
  const comment = context.store.pending(context.key).find((candidate) => candidate.id === id);
  const act = CARD_ACTIONS[action];
  if (comment === undefined || act === undefined) {
    return null;
  }
  act(context, comment);
  return action === "edit" ? comment.id : null;
}

/** Keeps what the owner types in a card's text box as that comment's draft. True for a card's text box. */
function noteDraft(drafts: Drafts, target: EventTarget | null): boolean {
  const textarea = closestElement(target, "textarea");
  const card = textarea === null ? null : cardAround(textarea);
  if (card !== null && drafts.has(card.id) && textarea !== null && "value" in textarea) {
    drafts.set(card.id, String(textarea.value));
  }
  return card !== null;
}

/** Puts the cursor in the text box of a comment's card. */
function focusEditor(document: Document, id: string): void {
  document.querySelector<HTMLTextAreaElement>(`[${ID_ATTRIBUTE}="${id}"] textarea`)?.focus();
}

/** The ids of the cards on the page, in page order. */
function cardIdsOnPage(document: Document): string[] {
  return [...document.querySelectorAll(`[${ID_ATTRIBUTE}]`)].map(
    (holder) => holder.getAttribute(ID_ATTRIBUTE) ?? "",
  );
}

/**
 * Puts focus back after a card was drawn again, so it does not fall to the page: on the
 * card's Edit button, or the nearest card's when it is gone, or else on "Submit review".
 */
function refocusCard(document: Document, id: string, idsBefore: string[]): void {
  const at = Math.max(idsBefore.indexOf(id), 0);
  const nearest = [id, ...idsBefore.slice(at + 1), ...idsBefore.slice(0, at).toReversed()];
  const editButtons = nearest.map((candidate) =>
    document.querySelector<HTMLElement>(
      `[${ID_ATTRIBUTE}="${candidate}"] [data-fix-ado-review-action="edit"]`,
    ),
  );
  const target =
    editButtons.find((button) => button !== null) ??
    document.querySelector<HTMLElement>('[data-fix-ado-review-action="finish"]');
  target?.focus();
}

/**
 * Notes where focus is before a click on a review button. The function it returns runs after
 * the page is drawn again: it puts the cursor in a card whose edit started, or else focuses
 * near a card the click redrew, so focus does not fall to the page.
 */
function keepCardFocus(document: Document, button: Element): (editedId: string | null) => void {
  const cardId = cardAround(button)?.id ?? null;
  const idsBefore = cardIdsOnPage(document);
  return (editedId) => {
    if (editedId !== null) {
      focusEditor(document, editedId);
    } else if (cardId !== null && !button.isConnected) {
      refocusCard(document, cardId, idsBefore);
    }
  };
}

export type { CardContext, Drafts };
export { handleCardAction, keepCardFocus, noteDraft, saveDrafts };
