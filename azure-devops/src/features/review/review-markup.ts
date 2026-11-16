// Small builders for the review's own markup.
import type { PendingComment } from "./review-store.ts";
import { closestElement } from "../../core/closest-element.ts";

interface ElementOptions {
  className?: string;
  text?: string;
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: Tag,
  { className, text }: ElementOptions = {},
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  if (className !== undefined) {
    created.className = className;
  }
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

/** The attribute that names what a click on one of the review's own buttons does. */
const ACTION_ATTRIBUTE = "data-fix-ado-review-action";
const BUTTON_CLASS = "bolt-button enabled bolt-focus-treatment";
const PRIMARY_BUTTON_CLASS = "bolt-button enabled primary bolt-focus-treatment";

/** A button like Azure DevOps's own. A click is handled by its `action`. */
function actionButton(
  document: Document,
  { action, isPrimary = false, text }: { action: string; text: string; isPrimary?: boolean },
): HTMLButtonElement {
  const button = element(document, "button", {
    className: isPrimary ? PRIMARY_BUTTON_CLASS : BUTTON_CLASS,
    text,
  });
  button.type = "button";
  button.setAttribute(ACTION_ATTRIBUTE, action);
  return button;
}

/** One of the review's own buttons, and what a click on it does. */
interface ClickedAction {
  action: string;
  button: Element;
}

/** The review's button a click landed on, or null. */
function clickedAction(target: EventTarget | null): ClickedAction | null {
  const button = closestElement(target, `[${ACTION_ATTRIBUTE}]`);
  const action = button?.getAttribute(ACTION_ATTRIBUTE) ?? null;
  return button === null || action === null ? null : { action, button };
}

/** "1 pending comment", "3 pending comments". */
function pendingCountText(count: number): string {
  return `${count} pending comment${count === 1 ? "" : "s"}`;
}

/** The pending comments as text to paste elsewhere, each with its file and line. */
function asMarkdown(pending: PendingComment[]): string {
  return pending
    .map(({ anchor, content }) =>
      anchor === null ? content : `**${anchor.filePath}, line ${anchor.line}**\n\n${content}`,
    )
    .join("\n\n---\n\n");
}

export type { ClickedAction };
export { actionButton, asMarkdown, clickedAction, element, pendingCountText };
