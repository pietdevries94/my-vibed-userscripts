// The field that finds a person or group to star. It copies Azure DevOps's add reviewer
// field and its suggestion list, so its styles apply, and searches the same way.
import { createAvatar, detailOf, element, fontIcon } from "./starred-reviewers-markup.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { wrapIn } from "../../pipeline/pipeline-issue-list.ts";

const SEARCH_DELAY_MS = 300;
const SUGGESTED_CLASS = "bolt-suggestions-isSuggested";
/** One picker is open at a time, so its list has a fixed id. */
const LIST_ID = "fix-ado-star-picker-list";

interface StarPickerOptions {
  document: Document;
  search: (query: string) => Promise<Identity[]>;
  imageUrlOf: (identity: Identity) => string;
  isStarred: (id: string) => boolean;
  onPick: (identity: Identity) => void;
  onClose: () => void;
  /** Runs `callback` after `delayMs`; returns a function that cancels it. */
  schedule: (callback: () => void, delayMs: number) => () => void;
}

interface StarPicker {
  element: HTMLElement;
  input: HTMLInputElement;
}

/** The parts the field's handlers share. */
interface PickerParts {
  options: StarPickerOptions;
  input: HTMLInputElement;
  callout: HTMLElement;
  list: HTMLElement;
  /** Counts searches, so an answer to an older one is dropped. */
  searchCount: number;
  cancelSearch: (() => void) | null;
}

function div(className: string): { tag: string; className: string } {
  return { className, tag: "div" };
}

function createPersonaName(document: Document, identity: Identity): HTMLElement {
  const detail = element(document, "div", {
    className: "fontSize secondary-text text-ellipsis",
    text: detailOf(identity),
  });
  return element(document, "div", {
    children: [
      element(document, "div", {
        className: "fontSizeM text-ellipsis",
        text: identity.displayName,
      }),
      element(document, "div", { children: [detail], className: "flex-row" }),
    ],
    className: "bolt-picker-persona-name flex-column flex-grow",
  });
}

function createSuggestion(
  options: StarPickerOptions,
  identity: Identity,
  index: number,
): HTMLElement {
  const { document } = options;
  const text = element(document, "div", {
    children: [
      createAvatar(document, identity, options.imageUrlOf(identity)),
      createPersonaName(document, identity),
    ],
    className: "bolt-picker-suggesteditem-text flex-row flex-grow flex-center text-ellipsis",
  });
  const item = wrapIn(document, text, [
    div("bolt-suggestions-item-button flex-row flex-grow scroll-hidden"),
    div(
      "bolt-identitypickerdropdown-item bolt-suggestions-item flex-row flex-grow cursor-pointer scroll-hidden",
    ),
  ]);
  // The field keeps focus, so a click does not close the picker before it picks.
  item.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  item.addEventListener("click", () => {
    options.onPick(identity);
  });
  return element(document, "div", {
    attributes: { "aria-selected": "false", id: `${LIST_ID}-${index}`, role: "option" },
    children: [item],
    className: "flex-noshrink",
  });
}

function createNoResults(document: Document): HTMLElement {
  const text = element(document, "div", {
    className: "bolt-identitypickerdropdown-noresults flex-row flex-grow flex-center",
    text: "No identities found",
  });
  return element(document, "div", {
    attributes: { role: "status" },
    children: [text],
    className: "bolt-suggestions-none-region flex-row flex-grow",
  });
}

function createCallout(document: Document): { callout: HTMLElement; list: HTMLElement } {
  const list = element(document, "div", {
    attributes: { id: LIST_ID, role: "listbox" },
    className: "bolt-suggestions-container flex-column flex-grow v-scroll-auto h-scroll-hidden",
  });
  const callout = wrapIn(document, list, [
    div("bolt-identitypickerdropdown-list bolt-suggestions flex-row flex-grow"),
    div(
      "bolt-identitypickerdropdown-callout-content flex-row flex-grow bolt-callout-content bolt-callout-shadow",
    ),
    div("fix-ado-star-picker-callout bolt-identitypickerdropdown-callout bolt-callout flex-row"),
  ]);
  callout.hidden = true;
  return { callout, list };
}

function createSearchInput(document: Document): HTMLInputElement {
  const input = document.createElement("input");
  input.className = "bolt-textfield-input flex-grow bolt-textfield-input-with-prefix";
  input.type = "text";
  input.placeholder = "Search people and groups";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", "Search people and groups to star");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", LIST_ID);
  return input;
}

function createField(document: Document): { field: HTMLElement; input: HTMLInputElement } {
  const input = createSearchInput(document);
  const prefix = fontIcon(document, "Contact", "medium");
  prefix.firstElementChild?.classList.add("prefix", "bolt-textfield-no-text");
  const field = element(document, "div", {
    children: [prefix, input],
    className:
      "repos-reviewers-identity-picker bolt-identitypickerdropdown-textField flex-row flex-center bolt-textfield focus-treatment focused",
  });
  return { field, input };
}

/** Shows or hides the suggestions, and tells the field. */
function setExpanded({ callout, input }: PickerParts, isExpanded: boolean): void {
  callout.hidden = !isExpanded;
  input.setAttribute("aria-expanded", String(isExpanded));
  input.removeAttribute("aria-activedescendant");
}

function showFound(parts: PickerParts, found: Identity[]): void {
  const { options, list } = parts;
  const unstarred = found.filter(({ id }) => !options.isStarred(id));
  // "No identities found" is a status, so the list is a listbox only while it holds options.
  if (unstarred.length > 0) {
    list.setAttribute("role", "listbox");
  } else {
    list.removeAttribute("role");
  }
  list.replaceChildren(
    ...(unstarred.length === 0
      ? [createNoResults(options.document)]
      : unstarred.map((identity, index) => createSuggestion(options, identity, index))),
  );
  setExpanded(parts, true);
}

async function search(parts: PickerParts, query: string): Promise<void> {
  parts.searchCount += 1;
  const thisSearch = parts.searchCount;
  const found = await parts.options.search(query).catch((): Identity[] => []);
  if (thisSearch === parts.searchCount && parts.input.value.trim() === query) {
    showFound(parts, found);
  }
}

function stopSearch(parts: PickerParts): void {
  parts.searchCount += 1;
  parts.cancelSearch?.();
  parts.cancelSearch = null;
}

function onInput(parts: PickerParts): void {
  stopSearch(parts);
  const query = parts.input.value.trim();
  if (query === "") {
    setExpanded(parts, false);
    return;
  }
  parts.cancelSearch = parts.options.schedule(() => {
    void search(parts, query);
  }, SEARCH_DELAY_MS);
}

/** Moves the highlight one suggestion up or down, and points the field at it. */
function moveSuggestion({ input, list }: PickerParts, step: number): void {
  const options = [...list.querySelectorAll('[role="option"]')];
  const current = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
  const next = Math.min(Math.max(current + step, 0), options.length - 1);
  for (const [index, option] of options.entries()) {
    option.setAttribute("aria-selected", String(index === next));
    option
      .querySelector(".bolt-suggestions-item")
      ?.classList.toggle(SUGGESTED_CLASS, index === next);
  }

  const nextOption = options[next];
  if (nextOption !== undefined) {
    input.setAttribute("aria-activedescendant", nextOption.id);
  }
}

function onKeyDown(parts: PickerParts, event: KeyboardEvent): void {
  if (event.key === "Escape") {
    parts.options.onClose();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSuggestion(parts, event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    parts.list.querySelector<HTMLElement>(`.${SUGGESTED_CLASS}`)?.click();
  }
}

function createStarPicker(options: StarPickerOptions): StarPicker {
  const { document } = options;
  const { field, input } = createField(document);
  const { callout, list } = createCallout(document);
  const parts: PickerParts = { callout, cancelSearch: null, input, list, options, searchCount: 0 };
  input.addEventListener("input", () => {
    onInput(parts);
  });
  input.addEventListener("keydown", (event) => {
    onKeyDown(parts, event);
  });
  input.addEventListener("blur", () => {
    stopSearch(parts);
    options.onClose();
  });
  const dropdown = wrapIn(document, field, [
    div("flex-column bolt-identitypickerdropdown-container flex-grow"),
    div("bolt-identitypickerdropdown flex-row flex-grow"),
  ]);
  const picker = element(document, "div", {
    children: [dropdown, callout],
    className: "fix-ado-star-picker margin-bottom-8",
  });
  return { element: picker, input };
}

export type { StarPickerOptions };
export { createStarPicker };
