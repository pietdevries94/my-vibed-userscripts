// The field that finds a person or group to star. It copies Azure DevOps's add reviewer
// field and its suggestion list, so its styles apply, and searches the same way.
import { createAvatar, detailOf, element, fontIcon } from "./starred-reviewers-markup.ts";
import type { Identity } from "./reviewer-requests.ts";
import { wrapIn } from "./pipeline-issue-list.ts";

const SEARCH_DELAY_MS = 300;
const SUGGESTED_CLASS = "bolt-suggestions-isSuggested";

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

function createSuggestion(options: StarPickerOptions, identity: Identity): HTMLElement {
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
    attributes: { role: "option" },
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
    attributes: { role: "alert" },
    children: [text],
    className: "bolt-suggestions-none-region flex-row flex-grow",
  });
}

function createCallout(document: Document): { callout: HTMLElement; list: HTMLElement } {
  const list = element(document, "div", {
    attributes: { role: "listbox" },
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

function showFound(parts: PickerParts, found: Identity[]): void {
  const { options, list, callout, input } = parts;
  const unstarred = found.filter(({ id }) => !options.isStarred(id));
  list.replaceChildren(
    ...(unstarred.length === 0
      ? [createNoResults(options.document)]
      : unstarred.map((identity) => createSuggestion(options, identity))),
  );
  callout.hidden = false;
  input.setAttribute("aria-expanded", "true");
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
    parts.callout.hidden = true;
    return;
  }
  parts.cancelSearch = parts.options.schedule(() => {
    void search(parts, query);
  }, SEARCH_DELAY_MS);
}

/** Moves the highlight one suggestion up or down. */
function moveSuggestion(list: HTMLElement, step: number): void {
  const items = [...list.querySelectorAll(".bolt-suggestions-item")];
  const current = items.findIndex((item) => item.classList.contains(SUGGESTED_CLASS));
  const next = Math.min(Math.max(current + step, 0), items.length - 1);
  items[current]?.classList.remove(SUGGESTED_CLASS);
  items[next]?.classList.add(SUGGESTED_CLASS);
}

function onKeyDown(parts: PickerParts, event: KeyboardEvent): void {
  if (event.key === "Escape") {
    parts.options.onClose();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSuggestion(parts.list, event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter") {
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
