// Starred reviewers on a pull request's Overview. A star on each reviewer row keeps
// that person or group in the owner's starred list. Under Optional, "Add starred as
// reviewer" lists the starred ones not on the pull request yet, each with a + button
// that adds them as optional, and an arrow for "Add as required reviewer".
import {
  STARRED_SECTION_CLASS,
  STAR_BUTTON_CLASS,
  createEmptyWell,
  createStarredRow,
  createStarredSection,
} from "./starred-reviewers-markup.ts";
import { addStars, isOnPage, nameOfRow } from "./reviewer-stars.ts";
import type { AdoClient } from "./ado-client.ts";
import type { Identity } from "./reviewer-requests.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import type { StarredReviewersStore } from "./starred-reviewers-store.ts";
import { closestHtmlElement } from "./closest-element.ts";
import { createStarPicker } from "./star-picker.ts";
import { isNameOf } from "./starred-reviewers-store.ts";
import { openAddReviewerMenu } from "./add-reviewer-menu.ts";

/** How long Azure DevOps gets to show an added reviewer before the page reloads to show it. */
const ADDED_REVIEWER_WAIT_MS = 4000;

interface StarredReviewersOptions {
  document: Document;
  store: StarredReviewersStore;
  client: Pick<
    AdoClient,
    "addPullRequestReviewer" | "getPullRequestReviewers" | "searchIdentities"
  >;
  imageUrlOf: (identity: Identity) => string;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule: (callback: () => void, delayMs: number) => () => void;
  reload: () => void;
}

interface StarredReviewers {
  /** Adds the stars and the starred section on a pull request's Overview. */
  sync: (pullRequest: PullRequestRef | null) => void;
}

/** What the feature keeps between syncs. */
interface StarredState {
  options: StarredReviewersOptions;
  pullRequest: PullRequestRef | null;
  /** Added by the + button. Hidden from the starred list until Azure DevOps shows them. */
  addedIds: Set<string>;
  /** Being added right now. */
  busyIds: Set<string>;
  errorsById: Map<string, string>;
  closeMenu: (() => void) | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

async function toggleStar(state: StarredState, row: HTMLElement): Promise<void> {
  const { store, client } = state.options;
  const name = nameOfRow(row);
  const starred = store.findByName(name);
  if (starred !== null) {
    store.unstar(starred.id);
  } else if (state.pullRequest !== null) {
    const reviewers = await client.getPullRequestReviewers(state.pullRequest);
    const reviewer = reviewers.find((identity) => isNameOf(identity, name));
    if (reviewer !== undefined) {
      store.star(reviewer);
    }
  }
  sync(state);
}

/** Reloads the page when Azure DevOps does not show a reviewer the + button added. */
function reloadUnlessShown(state: StarredState, identity: Identity): void {
  const { document, schedule, reload } = state.options;
  schedule(() => {
    if (!isOnPage(document, identity)) {
      reload();
    }
  }, ADDED_REVIEWER_WAIT_MS);
}

function markBusy(state: StarredState, id: string, isBusy: boolean): void {
  if (isBusy) {
    state.busyIds.add(id);
    state.errorsById.delete(id);
  } else {
    state.busyIds.delete(id);
  }
  sync(state);
}

async function addReviewer(
  state: StarredState,
  identity: Identity,
  isRequired: boolean,
): Promise<void> {
  const { pullRequest } = state;
  if (pullRequest === null || state.busyIds.has(identity.id)) {
    return;
  }
  markBusy(state, identity.id, true);
  try {
    await state.options.client.addPullRequestReviewer(pullRequest, {
      isRequired,
      reviewerId: identity.id,
    });
    state.addedIds.add(identity.id);
    reloadUnlessShown(state, identity);
  } catch (error) {
    state.errorsById.set(identity.id, `Could not add: ${messageOf(error)}`);
  } finally {
    markBusy(state, identity.id, false);
  }
}

function openPicker(state: StarredState, opener: HTMLElement): void {
  const { document, store, client, imageUrlOf, schedule } = state.options;
  let close: (() => void) | null = null;
  const picker = createStarPicker({
    document,
    imageUrlOf,
    isStarred: (id) => store.isStarred(id),
    onClose: (): void => {
      close?.();
    },
    onPick: (identity) => {
      store.star(identity);
      close?.();
      sync(state);
    },
    schedule,
    search: async (query) => client.searchIdentities(query),
  });
  close = (): void => {
    close = null;
    picker.element.remove();
    opener.hidden = false;
  };
  opener.hidden = true;
  opener.before(picker.element);
  picker.input.focus();
}

function identityOfRow(state: StarredState, target: EventTarget | null): Identity | null {
  const row = closestHtmlElement(target, "[data-fix-ado-identity]");
  const id = row?.dataset.fixAdoIdentity;
  return state.options.store.list().find((identity) => identity.id === id) ?? null;
}

/** A click on a starred row's star, + button or arrow. */
function onRowButton(state: StarredState, button: HTMLElement, identity: Identity): void {
  if (button.classList.contains(STAR_BUTTON_CLASS)) {
    state.options.store.unstar(identity.id);
    sync(state);
  } else if (button.dataset.fixAdoAdd === "menu") {
    state.closeMenu?.();
    state.closeMenu = openAddReviewerMenu(state.options.document, button, () => {
      void addReviewer(state, identity, true);
    });
  } else {
    void addReviewer(state, identity, false);
  }
}

function onSectionClick(state: StarredState, event: Event): void {
  const opener = closestHtmlElement(event.target, ".fix-ado-star-someone");
  if (opener !== null) {
    openPicker(state, opener);
    return;
  }
  const identity = identityOfRow(state, event.target);
  const button = closestHtmlElement(event.target, `[data-fix-ado-add], .${STAR_BUTTON_CLASS}`);
  if (identity !== null && button !== null) {
    onRowButton(state, button, identity);
  }
}

function placeSection(state: StarredState, anchor: Element): HTMLElement {
  const { document } = state.options;
  let section = document.querySelector<HTMLElement>(`.${STARRED_SECTION_CLASS}`);
  if (section === null) {
    section = createStarredSection(document);
    section.addEventListener("click", (event) => {
      onSectionClick(state, event);
    });
  }
  if (anchor.nextElementSibling !== section) {
    anchor.after(section);
  }
  return section;
}

function disableAddButtons(row: HTMLElement): void {
  for (const button of row.querySelectorAll("[data-fix-ado-add]")) {
    button.classList.replace("enabled", "disabled");
    button.setAttribute("disabled", "");
  }
}

function showError(row: HTMLElement, error: string): void {
  const detail = row.querySelector(".fix-ado-starred-detail");
  if (detail !== null) {
    detail.textContent = error;
    detail.classList.replace("secondary-text", "error-text");
  }
}

function createShownRow(state: StarredState, identity: Identity): HTMLElement {
  const { document, imageUrlOf } = state.options;
  const row = createStarredRow(document, identity, imageUrlOf(identity));
  if (state.busyIds.has(identity.id)) {
    disableAddButtons(row);
  }
  const error = state.errorsById.get(identity.id);
  if (error !== undefined) {
    showError(row, error);
  }
  return row;
}

/** The starred reviewers the list shows: those not on the pull request and not just added. */
function shownIdentities(state: StarredState, starred: Identity[]): Identity[] {
  const { document } = state.options;
  for (const identity of starred) {
    if (state.addedIds.has(identity.id) && isOnPage(document, identity)) {
      state.addedIds.delete(identity.id);
    }
  }
  return starred.filter(
    (identity) => !state.addedIds.has(identity.id) && !isOnPage(document, identity),
  );
}

/** Fills the list. Only when what it shows changed, so the page's own changes do not loop. */
function fillList(state: StarredState, section: HTMLElement): void {
  const list = section.querySelector<HTMLElement>(".fix-ado-starred-list");
  const starred = state.options.store.list();
  const shown = shownIdentities(state, starred);
  const signature = JSON.stringify([
    starred.length,
    shown.map(({ id }) => [id, state.busyIds.has(id), state.errorsById.get(id) ?? ""]),
  ]);
  if (list === null || list.dataset.fixAdoSignature === signature) {
    return;
  }
  list.dataset.fixAdoSignature = signature;
  state.closeMenu?.();
  state.closeMenu = null;
  list.replaceChildren(
    ...(starred.length === 0
      ? [createEmptyWell(state.options.document)]
      : shown.map((identity) => createShownRow(state, identity))),
  );
}

function sync(state: StarredState): void {
  const { document } = state.options;
  const anchor =
    document.querySelector(".pr-optional-reviewers-section") ??
    document.querySelector(".pr-required-reviewers-section");
  if (state.pullRequest === null || anchor === null) {
    return;
  }
  addStars(document, state.options.store, (row) => {
    void toggleStar(state, row);
  });
  fillList(state, placeSection(state, anchor));
}

function createStarredReviewers(options: StarredReviewersOptions): StarredReviewers {
  const state: StarredState = {
    addedIds: new Set(),
    busyIds: new Set(),
    closeMenu: null,
    errorsById: new Map(),
    options,
    pullRequest: null,
  };
  return {
    sync(pullRequest) {
      state.pullRequest = pullRequest;
      sync(state);
    },
  };
}

export type { StarredReviewersOptions };
export { createStarredReviewers };
