// Azure DevOps's reviewer fields on the create pull request page: finding them, what they
// hold, typing into one as a person does, and pressing one of its suggestions.
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { isNameOf } from "./starred-reviewers-store.ts";

/** Azure DevOps's reviewer fields, by the id of their label. Required shows after its toggle. */
const FIELD_LABEL_IDS = [
  "__bolt-pr-optional-reviewers-label",
  "__bolt-pr-required-reviewers-label",
];

interface ReviewerField {
  /** The column with the label and the picker, where the chips go last. */
  column: HTMLElement;
  input: HTMLInputElement;
}

function reviewerFields(document: Document): ReviewerField[] {
  const fields: ReviewerField[] = [];
  for (const labelId of FIELD_LABEL_IDS) {
    const column = document.querySelector(`#${labelId}`)?.parentElement?.parentElement;
    const input = column?.querySelector<HTMLInputElement>(`input[aria-labelledby="${labelId}"]`);
    if (column !== null && column !== undefined && input !== null && input !== undefined) {
      fields.push({ column, input });
    }
  }
  return fields;
}

/** The names in every reviewer field. */
function namesInFields(document: Document): string[] {
  return [...document.querySelectorAll(".bolt-identity-picker-pill .bolt-pill-content")].map(
    (pill) => pill.textContent?.trim() ?? "",
  );
}

/** Sets the value as typing does, so Azure DevOps's React field sees it. */
function typeInto(input: HTMLInputElement, text: string): void {
  input.focus();
  const pageWindow = input.ownerDocument.defaultView;
  // The input's own setter, past the one React puts on the element.
  Reflect.set((pageWindow?.HTMLInputElement ?? HTMLInputElement).prototype, "value", text, input);
  const EventOfPage = pageWindow?.Event ?? Event;
  input.dispatchEvent(new EventOfPage("input", { bubbles: true }));
}

function isSuggestionOf(option: Element, identity: Identity): boolean {
  const name = option.querySelector(".bolt-picker-persona-name > :first-child")?.textContent ?? "";
  const detail = option.querySelector(".bolt-picker-persona-name .secondary-text")?.textContent;
  const address = identity.signInAddress.toLowerCase();
  return address === "" ? isNameOf(identity, name) : detail?.trim().toLowerCase() === address;
}

/** The suggestion row of this identity in the field's listbox, or null while it is not there. */
function findSuggestion(
  document: Document,
  input: HTMLInputElement,
  identity: Identity,
): Element | null {
  const listboxId = input.getAttribute("aria-controls");
  const listbox = listboxId === null ? null : document.querySelector(`[id="${listboxId}"]`);
  return (
    [...(listbox?.querySelectorAll('[role="option"]') ?? [])].find((candidate) =>
      isSuggestionOf(candidate, identity),
    ) ?? null
  );
}

function isInField(document: Document, identity: Identity): boolean {
  return namesInFields(document).some((name) => isNameOf(identity, name));
}

/** Presses and releases the mouse on the element, as a real click does. Some fields pick on mouse down. */
function pressMouseOn(element: Element): void {
  const pageWindow = element.ownerDocument.defaultView;
  const MouseEventOfPage = pageWindow?.MouseEvent ?? MouseEvent;
  const PointerEventOfPage = pageWindow?.PointerEvent ?? MouseEventOfPage;
  const init = { bubbles: true, button: 0, cancelable: true, composed: true };
  element.dispatchEvent(new PointerEventOfPage("pointerdown", init));
  element.dispatchEvent(new MouseEventOfPage("mousedown", init));
  element.dispatchEvent(new PointerEventOfPage("pointerup", init));
  element.dispatchEvent(new MouseEventOfPage("mouseup", init));
  element.dispatchEvent(new MouseEventOfPage("click", init));
}

function pressEnterIn(input: HTMLInputElement): void {
  const KeyboardEventOfPage = input.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const init = { bubbles: true, cancelable: true, code: "Enter", key: "Enter", keyCode: 13 };
  input.dispatchEvent(new KeyboardEventOfPage("keydown", init));
  input.dispatchEvent(new KeyboardEventOfPage("keyup", init));
}

export type { ReviewerField };
export {
  findSuggestion,
  isInField,
  namesInFields,
  pressEnterIn,
  pressMouseOn,
  reviewerFields,
  typeInto,
};
