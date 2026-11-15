// Starred reviewers on the create pull request page. Under each reviewer field, a chip
// per starred reviewer not in a field yet. The pull request does not exist yet, so a
// click fills Azure DevOps's own field: it types the reviewer and picks their suggestion.
import {
  STARRED_CHIP_CLASS,
  STARRED_CHIP_ROW_CLASS,
  createStarredChip,
  createStarredChipRow,
  showChipSpinner,
} from "./starred-reviewer-chips-markup.ts";
import {
  findSuggestion,
  isInField,
  namesInFields,
  pressEnterIn,
  pressMouseOn,
  reviewerFields,
  typeInto,
} from "./reviewer-field.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import type { ReviewerField } from "./reviewer-field.ts";
import type { StarredReviewersStore } from "./starred-reviewers-store.ts";
import { closestHtmlElement } from "../../core/closest-element.ts";
import { isNameOf } from "./starred-reviewers-store.ts";
import { log } from "../../../../shared/runtime/script-log.ts";
import { personOrTeamName } from "../../pull-requests/reviewers.ts";

const SUGGESTION_POLL_MS = 250;
/** How long the field gets to show the reviewer among its suggestions: 5 seconds. */
const SUGGESTION_POLLS = 20;
/** On the body while a chip picks: style.css hides the field's dropdown and typed text then. */
const PICKING_CLASS = "fix-ado-starred-picking";
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

interface ChipsState {
  options: StarredReviewerChipsOptions;
  isCreatePage: boolean;
  /** Being typed into a field right now. */
  busyIds: Set<string>;
  notFoundIds: Set<string>;
}

/** What to type: a person's sign-in address finds only them; a team by its own name. */
function searchTextOf(identity: Identity): string {
  return identity.signInAddress === ""
    ? personOrTeamName(identity.displayName)
    : identity.signInAddress;
}

/**
 * A reviewer typed into a field. `waiting` for their suggestion, `clicked` it, or
 * `entered`: pressed Enter while it was the highlighted one.
 */
interface PendingPick {
  field: ReviewerField;
  identity: Identity;
  step: "waiting" | "clicked" | "entered";
  pollsLeft: number;
}

function finishPick(state: ChipsState, { identity }: PendingPick, isPicked: boolean): void {
  log("Starred reviewers: chip pick finished", { isPicked });
  if (!isPicked) {
    state.notFoundIds.add(identity.id);
  }
  state.busyIds.delete(identity.id);
  sync(state);
}

/** The next step once the suggestion is there: click it, then press Enter on it, then give up. */
function nextStep(pendingPick: PendingPick, suggestion: Element): PendingPick["step"] | null {
  if (pendingPick.step === "waiting") {
    pressMouseOn(suggestion.querySelector(".bolt-suggestions-item") ?? suggestion);
    return "clicked";
  }
  const { input } = pendingPick.field;
  if (
    pendingPick.step === "clicked" &&
    input.getAttribute("aria-activedescendant") === suggestion.id
  ) {
    pressEnterIn(input);
    return "entered";
  }
  return null;
}

/** Looks for the suggestion and takes the next step, until the reviewer is in the field or it gives up. */
function pickSuggestion(state: ChipsState, pendingPick: PendingPick): void {
  const { document, schedule } = state.options;
  const { field, identity, pollsLeft } = pendingPick;
  const suggestion = isInField(document, identity)
    ? null
    : findSuggestion(document, field.input, identity);
  const step = suggestion === null ? pendingPick.step : nextStep(pendingPick, suggestion);
  log("Starred reviewers: chip pick", {
    from: pendingPick.step,
    hasSuggestion: suggestion !== null,
    to: step,
  });
  if (step === null || pollsLeft <= 0 || isInField(document, identity)) {
    finishPick(state, pendingPick, isInField(document, identity));
    return;
  }
  schedule(() => {
    pickSuggestion(state, { ...pendingPick, pollsLeft: pollsLeft - 1, step });
  }, SUGGESTION_POLL_MS);
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
    pickSuggestion(state, { field, identity, pollsLeft: SUGGESTION_POLLS, step: "waiting" });
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
    showChipSpinner(document, chip);
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

function removeChipRows(document: Document): void {
  for (const row of document.querySelectorAll(`.${STARRED_CHIP_ROW_CLASS}`)) {
    row.remove();
  }
}

function sync(state: ChipsState): void {
  const { document, store } = state.options;
  const fields = reviewerFields(document);
  document.body.classList.toggle(PICKING_CLASS, state.isCreatePage && state.busyIds.size > 0);
  if (!state.isCreatePage) {
    removeChipRows(document);
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
