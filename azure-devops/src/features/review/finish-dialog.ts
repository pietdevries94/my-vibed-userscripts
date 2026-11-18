// "Finish your review": a general comment, the vote, the pending comments, and the
// buttons that submit or discard the review.
import type { ReviewChoices, SubmitResult } from "./review-submit.ts";
import { actionButton, clickedAction, element, pendingCountText } from "./review-markup.ts";
import type { PendingComment } from "./review-store.ts";

const DIALOG_CLASS = "fix-ado-review-dialog";
const TITLE = "Finish your review";
const TITLE_ID = "fix-ado-review-dialog-title";

/** The vote each option sends. "Comment" sends none, so an earlier vote stays. */
const VOTE_OPTIONS: { label: string; description: string; vote: number | null }[] = [
  {
    description: "Submit general feedback without explicit approval.",
    label: "Comment",
    vote: null,
  },
  { description: "Submit feedback and approve merging these changes.", label: "Approve", vote: 10 },
  { description: "Approve, and leave suggestions.", label: "Approve with suggestions", vote: 5 },
  { description: "Submit feedback suggesting changes.", label: "Wait for author", vote: -5 },
  { description: "Reject these changes.", label: "Reject", vote: -10 },
];

interface FinishDialogOptions {
  document: Document;
  pending: () => PendingComment[];
  /** Posts the review. Called with how far it is while it runs. */
  submit: (
    choices: ReviewChoices,
    onProgress: (handled: number, total: number) => void,
  ) => Promise<SubmitResult>;
  discard: () => void;
  /** Called when everything is posted, after the dialog closed. */
  onSubmitted: () => void;
}

function voteOption(document: Document, index: number): HTMLElement {
  const option = element(document, "label", { className: "fix-ado-review-vote" });
  const radio = element(document, "input");
  radio.type = "radio";
  radio.name = "fix-ado-review-vote";
  radio.value = String(index);
  radio.checked = index === 0;
  const text = element(document, "span");
  text.append(
    element(document, "strong", { text: VOTE_OPTIONS[index]?.label }),
    element(document, "span", {
      className: "secondary-text",
      text: VOTE_OPTIONS[index]?.description,
    }),
  );
  option.append(radio, text);
  return option;
}

function voteOptions(document: Document): HTMLElement {
  const group = element(document, "fieldset", { className: "fix-ado-review-votes" });
  group.append(...VOTE_OPTIONS.map((_option, index) => voteOption(document, index)));
  return group;
}

function placeOf({ anchor }: PendingComment): string {
  return anchor === null ? "Pull request" : `${anchor.filePath}, line ${anchor.line}`;
}

/** The pending comments, collapsed, as GitHub lists them. */
function pendingList(document: Document, pending: PendingComment[]): HTMLElement {
  const details = element(document, "details", { className: "fix-ado-review-pending-list" });
  details.append(element(document, "summary", { text: pendingCountText(pending.length) }));
  for (const comment of pending) {
    const item = element(document, "div", { className: "fix-ado-review-pending-item" });
    item.append(
      element(document, "div", { className: "secondary-text", text: placeOf(comment) }),
      element(document, "div", { className: "fix-ado-review-card-text", text: comment.content }),
    );
    details.append(item);
  }
  return details;
}

function chosenVote(dialog: HTMLDialogElement): number | null {
  const checked = dialog.querySelector<HTMLInputElement>("input[type=radio]:checked");
  return VOTE_OPTIONS[Number(checked?.value ?? 0)]?.vote ?? null;
}

/** Marks the dialog as posting. Esc then leaves it open, so the outcome stays in view. */
function setBusy(dialog: HTMLDialogElement, isBusy: boolean): void {
  dialog.toggleAttribute("aria-busy", isBusy);
  for (const control of dialog.querySelectorAll<HTMLButtonElement>("button, input, textarea")) {
    control.disabled = isBusy;
  }
}

/** What went wrong, or null when everything is posted. */
function problemOf({ failures, vote }: SubmitResult): string | null {
  if (failures.length > 0) {
    const statuses = [...new Set(failures.map(({ httpStatus }) => httpStatus))].join(", ");
    return `${failures.length} of your comments could not be posted (HTTP ${statuses}). They are still pending. Submit again to retry.`;
  }
  return vote === "failed"
    ? "Your comments are posted, but your vote could not be saved. Vote with Azure DevOps's own button."
    : null;
}

/** Posts the review with what the dialog holds. Returns what went wrong, or null. */
async function postFrom(
  dialog: HTMLDialogElement,
  options: FinishDialogOptions,
): Promise<string | null> {
  const status = dialog.querySelector(".fix-ado-review-status");
  const summary = dialog.querySelector("textarea");
  const choices = { summary: summary?.value ?? "", vote: chosenVote(dialog) };
  setBusy(dialog, true);
  try {
    const result = await options.submit(choices, (handled, total) => {
      if (status !== null) {
        status.textContent = `Sending ${handled + 1} of ${total}`;
      }
    });
    return problemOf(result);
  } catch {
    return "Azure DevOps could not be reached. Nothing more was posted. Submit again to retry.";
  } finally {
    // The summary is in the review now. A retry must not add it again.
    if (summary !== null) {
      summary.value = "";
    }
  }
}

async function submitFrom(dialog: HTMLDialogElement, options: FinishDialogOptions): Promise<void> {
  const problem = await postFrom(dialog, options);
  if (problem === null || options.pending().length === 0) {
    dialog.close();
    options.onSubmitted();
    return;
  }
  setBusy(dialog, false);
  const status = dialog.querySelector(".fix-ado-review-status");
  if (status !== null) {
    status.textContent = problem;
  }
  dialog
    .querySelector(".fix-ado-review-pending-list")
    ?.replaceWith(pendingList(options.document, options.pending()));
}

function createButtons(document: Document): HTMLElement {
  const buttons = element(document, "div", { className: "fix-ado-review-dialog-buttons" });
  const right = element(document, "div", { className: "fix-ado-review-buttons" });
  right.append(
    actionButton(document, { action: "close", text: "Cancel" }),
    actionButton(document, { action: "submit", isPrimary: true, text: "Submit review" }),
  );
  buttons.append(
    actionButton(document, { action: "discard-review", text: "Discard review" }),
    right,
  );
  return buttons;
}

function summaryBox(document: Document): HTMLElement {
  const summary = element(document, "textarea", { className: "fix-ado-review-textarea" });
  summary.placeholder = "Leave a comment";
  summary.setAttribute("aria-label", "Leave a comment");
  return summary;
}

function statusLine(document: Document): HTMLElement {
  const status = element(document, "p", { className: "fix-ado-review-status" });
  status.setAttribute("role", "status");
  return status;
}

function createDialog(options: FinishDialogOptions): HTMLDialogElement {
  const { document } = options;
  const dialog = element(document, "dialog", { className: DIALOG_CLASS });
  const title = element(document, "h2", { className: "fix-ado-review-title", text: TITLE });
  title.id = TITLE_ID;
  dialog.setAttribute("aria-labelledby", TITLE_ID);
  dialog.append(
    title,
    summaryBox(document),
    voteOptions(document),
    pendingList(document, options.pending()),
    statusLine(document),
    createButtons(document),
  );
  return dialog;
}

function dialogActions(
  dialog: HTMLDialogElement,
  options: FinishDialogOptions,
): Record<string, () => void> {
  return {
    close: () => {
      dialog.close();
    },
    "discard-review": () => {
      // oxlint-disable-next-line eslint/no-alert -- one question before the owner's text is deleted
      if (globalThis.confirm(`Discard ${pendingCountText(options.pending().length)}?`)) {
        options.discard();
        dialog.close();
      }
    },
    submit: () => {
      void submitFrom(dialog, options);
    },
  };
}

/** Opens "Finish your review", built fresh so it shows the review as it is now. */
function openFinishDialog(options: FinishDialogOptions): void {
  const { document } = options;
  document.querySelector(`dialog.${DIALOG_CLASS}`)?.remove();
  const dialog = createDialog(options);
  const actions = dialogActions(dialog, options);
  dialog.addEventListener("click", (event) => {
    const clicked = clickedAction(event.target);
    if (clicked !== null) {
      actions[clicked.action]?.();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    if (dialog.hasAttribute("aria-busy")) {
      event.preventDefault();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}

export { DIALOG_CLASS, openFinishDialog };
