// The review's button in Azure DevOps's own comment boxes. It goes last in the box's
// button row, as the primary one. Azure DevOps's own button stays as it is: the
// stylesheet alone makes it look secondary and read "Add single comment".
import { BOX_SELECTOR, commentBoxOf, findCommentBoxes } from "./comment-boxes.ts";
import type { CommentBox } from "./comment-boxes.ts";
import { actionButton } from "./review-markup.ts";
import { closestElement } from "../../core/closest-element.ts";

const ADD_BUTTON_CLASS = "fix-ado-review-add";
const ADD_ACTION = "add";
const START_LABEL = "Start a review";
const ADD_LABEL = "Add review comment";
const TITLE = "Add to your review. Nothing is posted until you submit.";

function addButtonOf(box: CommentBox): HTMLButtonElement | null {
  return (
    box.postButton.parentElement?.querySelector<HTMLButtonElement>(`.${ADD_BUTTON_CLASS}`) ?? null
  );
}

function createAddButton(document: Document): HTMLButtonElement {
  const button = actionButton(document, { action: ADD_ACTION, isPrimary: true, text: "" });
  button.classList.add(ADD_BUTTON_CLASS);
  button.title = TITLE;
  return button;
}

function setIfChanged(button: HTMLButtonElement, label: string, isDisabled: boolean): void {
  if (button.textContent !== label) {
    button.textContent = label;
  }
  if (button.disabled !== isDisabled) {
    button.disabled = isDisabled;
    button.classList.toggle("disabled", isDisabled);
    button.classList.toggle("enabled", !isDisabled);
  }
}

/** Adds the review's button to every comment box, and keeps its label and state up to date. */
function syncAddButtons(document: Document, hasReview: boolean): void {
  for (const box of findCommentBoxes(document)) {
    let button = addButtonOf(box);
    if (button === null) {
      button = createAddButton(box.textarea.ownerDocument);
      box.postButton.after(button);
    }
    setIfChanged(button, hasReview ? ADD_LABEL : START_LABEL, box.textarea.value.trim() === "");
  }
}

/** The comment box an event came from, or null when the script does not know the box. */
function commentBoxAround(target: EventTarget | null): CommentBox | null {
  const box = closestElement(target, BOX_SELECTOR);
  return box === null ? null : commentBoxOf(box);
}

/** True when the box has the review's button, so a comment can go to the review. */
function hasAddButton(box: CommentBox): boolean {
  return addButtonOf(box) !== null;
}

/**
 * Empties the box and closes it with its own Cancel. The text goes through the
 * setter of every textarea and an input event, so Azure DevOps notices it is empty.
 */
function closeBox({ cancelButton, textarea }: CommentBox): void {
  const view = textarea.ownerDocument.defaultView;
  if (view !== null) {
    Reflect.set(view.HTMLTextAreaElement.prototype, "value", "", textarea);
    textarea.dispatchEvent(new view.Event("input", { bubbles: true }));
  }
  cancelButton?.click();
}

export type { CommentBox } from "./comment-boxes.ts";
export { ADD_ACTION, closeBox, commentBoxAround, hasAddButton, syncAddButtons };
