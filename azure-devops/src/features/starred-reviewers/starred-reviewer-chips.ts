// Starred reviewers on the create pull request page. Under each reviewer field, a chip
// per starred reviewer not in a field yet. The pull request does not exist yet, so a
// click fills Azure DevOps's own field: it types the reviewer and picks their suggestion.
import {
  STARRED_CHIP_CLASS,
  STARRED_CHIP_ROW_CLASS,
  createStarredChip,
  createStarredChipRow,
} from "./starred-reviewers-markup.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import type { StarredReviewersStore } from "./starred-reviewers-store.ts";
import { closestHtmlElement } from "../../core/closest-element.ts";
import { isNameOf } from "./starred-reviewers-store.ts";
import { personOrTeamName } from "../../pull-requests/reviewers.ts";

/** Azure DevOps's reviewer fields, by the id of their label. Required shows after its toggle. */
const FIELD_LABEL_IDS = [
  "__bolt-pr-optional-reviewers-label",
  "__bolt-pr-required-reviewers-label",
];
const SUGGESTION_POLL_MS = 250;
/** How long the field gets to show the reviewer among its suggestions: 5 seconds. */
const SUGGESTION_POLLS = 20;
const NOT_FOUND_TITLE = "Not found in the reviewer field's suggestions. Pick them there.";

interface StarredReviewerChipsOptions {
  document: Document;
  store: StarredReviewersStore;
  imageUrlOf: (identity: Identity) => string;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule: (callback: () => void, delayMs: number) => () => void;
}

interface StarredReviewerChips {
  /** Adds or updates the chips when `isCreatePage`. */
  sync: (isCreatePage: boolean) => void;
}

interface ReviewerField {
  /** The column with the label and the picker, where the chips go last. */
  column: HTMLElement;
  input: HTMLInputElement;
}

interface ChipsState {
  options: StarredReviewerChipsOptions;
  isCreatePage: boolean;
  /** Being typed into a field right now. */
  busyIds: Set<string>;
  notFoundIds: Set<string>;
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

/** What to type: a person's sign-in address finds only them; a team by its own name. */
function searchTextOf(identity: Identity): string {
  return identity.signInAddress === ""
    ? personOrTeamName(identity.displayName)
    : identity.signInAddress;
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

/** The suggestion of this identity in the field's listbox, or null while it is not there. */
function findSuggestion(
  document: Document,
  input: HTMLInputElement,
  identity: Identity,
): HTMLElement | null {
  const listboxId = input.getAttribute("aria-controls");
  const listbox = listboxId === null ? null : document.querySelector(`[id="${listboxId}"]`);
  const option = [...(listbox?.querySelectorAll('[role="option"]') ?? [])].find((candidate) =>
    isSuggestionOf(candidate, identity),
  );
  return option?.querySelector<HTMLElement>(".bolt-suggestions-item") ?? null;
}

/** A reviewer typed into a field, waiting for their suggestion: how often to look again. */
interface PendingPick {
  field: ReviewerField;
  identity: Identity;
  pollsLeft: number;
}

function pickSuggestion(state: ChipsState, pendingPick: PendingPick): void {
  const { document, schedule } = state.options;
  const { field, identity, pollsLeft } = pendingPick;
  const suggestion = findSuggestion(document, field.input, identity);
  if (suggestion !== null) {
    suggestion.click();
  } else if (pollsLeft > 0) {
    schedule(() => {
      pickSuggestion(state, { ...pendingPick, pollsLeft: pollsLeft - 1 });
    }, SUGGESTION_POLL_MS);
    return;
  } else {
    state.notFoundIds.add(identity.id);
  }
  state.busyIds.delete(identity.id);
  sync(state);
}

function addThroughField(state: ChipsState, field: ReviewerField, identity: Identity): void {
  if (state.busyIds.has(identity.id)) {
    return;
  }
  state.busyIds.add(identity.id);
  state.notFoundIds.delete(identity.id);
  sync(state);
  typeInto(field.input, searchTextOf(identity));
  state.options.schedule(() => {
    pickSuggestion(state, { field, identity, pollsLeft: SUGGESTION_POLLS });
  }, SUGGESTION_POLL_MS);
}

function onRowClick(state: ChipsState, field: ReviewerField, event: Event): void {
  const id = closestHtmlElement(event.target, `.${STARRED_CHIP_CLASS}`)?.dataset.fixAdoIdentity;
  const identity = state.options.store.list().find((starred) => starred.id === id);
  if (identity !== undefined) {
    addThroughField(state, field, identity);
  }
}

function createChip(state: ChipsState, identity: Identity): HTMLElement {
  const { document, imageUrlOf } = state.options;
  const chip = createStarredChip(document, identity, imageUrlOf(identity));
  if (state.busyIds.has(identity.id)) {
    chip.setAttribute("disabled", "");
    chip.classList.remove("clickable");
  }
  if (state.notFoundIds.has(identity.id)) {
    chip.title = NOT_FOUND_TITLE;
  }
  return chip;
}

/** The field's chip row, last in its column. */
function placeRow(state: ChipsState, field: ReviewerField): HTMLElement {
  let row = field.column.querySelector<HTMLElement>(`:scope > .${STARRED_CHIP_ROW_CLASS}`);
  if (row === null) {
    row = createStarredChipRow(state.options.document);
    row.addEventListener("click", (event) => {
      onRowClick(state, field, event);
    });
  }
  if (field.column.lastElementChild !== row) {
    field.column.append(row);
  }
  return row;
}

/** Fills the field's chip row, only when what it shows changed, so the page's own changes do not loop. */
function fillRow(state: ChipsState, field: ReviewerField, shown: Identity[]): void {
  if (shown.length === 0) {
    field.column.querySelector(`:scope > .${STARRED_CHIP_ROW_CLASS}`)?.remove();
    return;
  }
  const list = placeRow(state, field).querySelector<HTMLElement>(".fix-ado-starred-chip-list");
  const signature = JSON.stringify(
    shown.map(({ id }) => [id, state.busyIds.has(id), state.notFoundIds.has(id)]),
  );
  if (list !== null && list.dataset.fixAdoSignature !== signature) {
    list.dataset.fixAdoSignature = signature;
    list.replaceChildren(...shown.map((identity) => createChip(state, identity)));
  }
}

function sync(state: ChipsState): void {
  const { document, store } = state.options;
  const fields = reviewerFields(document);
  if (!state.isCreatePage) {
    for (const row of document.querySelectorAll(`.${STARRED_CHIP_ROW_CLASS}`)) {
      row.remove();
    }
    return;
  }
  const names = namesInFields(document);
  const shown = store.list().filter((identity) => !names.some((name) => isNameOf(identity, name)));
  for (const field of fields) {
    fillRow(state, field, shown);
  }
}

function createStarredReviewerChips(options: StarredReviewerChipsOptions): StarredReviewerChips {
  const state: ChipsState = {
    busyIds: new Set(),
    isCreatePage: false,
    notFoundIds: new Set(),
    options,
  };
  return {
    sync(isCreatePage) {
      state.isCreatePage = isCreatePage;
      sync(state);
    },
  };
}

export type { StarredReviewerChipsOptions };
export { createStarredReviewerChips };
