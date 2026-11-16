// One pending comment's card: "Pending", a note, "Edit", "Delete comment" and the
// text. While the owner edits the comment, the card shows a text box with the edit so
// far instead. The edit lives outside the card, so it survives when the page drops the
// card and draws it again.
import { actionButton, element } from "./review-markup.ts";
import type { PendingComment } from "./review-store.ts";

/** A pending comment as the page shows it. */
interface ShownComment extends PendingComment {
  /** The text of an edit the owner has not saved yet. Null when the comment is not being edited. */
  draft: string | null;
}

/** On the element that holds a comment's card: the comment's id. */
const ID_ATTRIBUTE = "data-fix-ado-review-id";
const EDITING_ATTRIBUTE = "data-fix-ado-review-editing";
const ONLY_YOU_NOTE = "Only you see this until you submit your review.";

function cardHeader(document: Document, note: string): HTMLElement {
  const header = element(document, "div", { className: "fix-ado-review-card-header" });
  header.append(
    element(document, "span", { className: "fix-ado-review-pending", text: "Pending" }),
    element(document, "span", { className: "fix-ado-review-card-note secondary-text", text: note }),
    actionButton(document, { action: "edit", text: "Edit" }),
    actionButton(document, { action: "remove", text: "Delete comment" }),
  );
  return header;
}

/** A text box with the edit so far, "Cancel" and "Update comment". */
function cardEditor(document: Document, draft: string): HTMLElement {
  const editor = element(document, "div", { className: "fix-ado-review-card-editor" });
  const textarea = element(document, "textarea", { className: "fix-ado-review-textarea" });
  textarea.value = draft;
  textarea.setAttribute("aria-label", "Edit pending comment");
  const buttons = element(document, "div", { className: "fix-ado-review-buttons" });
  buttons.append(
    actionButton(document, { action: "cancel-edit", text: "Cancel" }),
    actionButton(document, { action: "update", isPrimary: true, text: "Update comment" }),
  );
  editor.append(textarea, buttons);
  return editor;
}

function createCard(
  document: Document,
  { content, draft }: ShownComment,
  note: string,
): HTMLElement {
  const card = element(document, "div", { className: "fix-ado-review-card" });
  const body =
    draft === null
      ? element(document, "div", { className: "fix-ado-review-card-text", text: content })
      : cardEditor(document, draft);
  card.append(cardHeader(document, note), body);
  return card;
}

/** Notes on the element that holds a card which comment it shows, and whether as an edit. */
function markHolder(holder: HTMLElement, { content, draft, id }: ShownComment): void {
  holder.setAttribute(ID_ATTRIBUTE, id);
  holder.dataset.fixAdoReviewContent = content;
  holder.toggleAttribute(EDITING_ATTRIBUTE, draft !== null);
}

/** True when the holder's card shows this comment as it is now: its text, or its edit. */
function holdsCurrent(holder: HTMLElement, { content, draft }: ShownComment): boolean {
  return (
    holder.dataset.fixAdoReviewContent === content &&
    holder.hasAttribute(EDITING_ATTRIBUTE) === (draft !== null)
  );
}

/** The card an element sits in: its holder, and its comment's id. */
function cardAround(target: Element): { holder: HTMLElement; id: string } | null {
  const holder = target.closest<HTMLElement>(`[${ID_ATTRIBUTE}]`);
  const id = holder?.getAttribute(ID_ATTRIBUTE) ?? null;
  return holder === null || id === null ? null : { holder, id };
}

export type { ShownComment };
export { ID_ATTRIBUTE, ONLY_YOU_NOTE, cardAround, createCard, holdsCurrent, markHolder };
