// The question before a review is submitted while the owner still edits a pending
// comment: save the edits, drop them, or go back.
import { element, pendingCountText } from "./review-markup.ts";

interface UnsavedEditsOptions {
  document: Document;
  /** How many pending comments have an unsaved edit. */
  count: number;
  /** Called for "Yes" (true) and "No" (false). Not called for "Cancel". */
  onAnswer: (shouldSave: boolean) => void;
}

const BUTTON_CLASS = "bolt-button enabled bolt-focus-treatment";
const TITLE_ID = "fix-ado-review-unsaved-title";

function answerButton(dialog: HTMLDialogElement, text: string, answer: () => void): HTMLElement {
  const button = element(dialog.ownerDocument, "button", {
    className: text === "Yes" ? `${BUTTON_CLASS} primary` : BUTTON_CLASS,
    text,
  });
  button.type = "button";
  button.addEventListener("click", () => {
    dialog.close();
    answer();
  });
  return button;
}

/** Asks "Save your edits?" with "Yes", "No" and "Cancel". Esc is Cancel. */
function openUnsavedEditsDialog({ count, document, onAnswer }: UnsavedEditsOptions): void {
  const dialog = element(document, "dialog", {
    className: "fix-ado-review-dialog fix-ado-review-unsaved",
  });
  dialog.setAttribute("aria-labelledby", TITLE_ID);
  // Every way out closes the dialog, Esc included; it is built fresh each time.
  dialog.addEventListener("close", () => {
    dialog.remove();
  });
  const title = element(document, "h2", {
    className: "fix-ado-review-title",
    text: "Save your edits?",
  });
  title.id = TITLE_ID;
  const buttons = element(document, "div", { className: "fix-ado-review-buttons" });
  buttons.append(
    answerButton(dialog, "Cancel", () => {
      // The owner goes back to the edits.
    }),
    answerButton(dialog, "No", () => {
      onAnswer(false);
    }),
    answerButton(dialog, "Yes", () => {
      onAnswer(true);
    }),
  );
  dialog.append(
    title,
    element(document, "p", {
      text: `You are still editing ${pendingCountText(count)}. "No" drops the edits and keeps the comments as they were.`,
    }),
    buttons,
  );
  document.body.append(dialog);
  dialog.showModal();
}

export { openUnsavedEditsDialog };
