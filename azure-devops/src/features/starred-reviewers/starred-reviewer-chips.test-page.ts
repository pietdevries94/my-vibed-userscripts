// The create pull request page for the chip tests, with a stand-in for Azure DevOps's
// reviewer field. Test code only.

/** Who the stand-in picker finds, with the second line it shows. */
const DIRECTORY = [
  { detail: "quill@example.com", name: "Quill Barrow" },
  { detail: "quill.b@example.com", name: "Quill Barrows" },
  { detail: "marren@example.com", name: "Marren Tolk" },
  { detail: "", name: "Ledger Team" },
];

function pill(name: string): string {
  return `<div class="bolt-identity-picker-pill bolt-pill" role="listitem">
    <div class="bolt-pill-content text-ellipsis">${name}</div></div>`;
}

function reviewerField(labelId: string, label: string, pills: string[]): string {
  return `<div class="flex-column rhythm-vertical-8">
    <div class="flex-row flex-center"><label class="body-m" id="${labelId}">${label}</label></div>
    <div><div class="bolt-tag-picker"><div class="bolt-tag-picker-group">
      <div role="list" aria-labelledby="${labelId}">${pills.join("")}</div>
      <div class="bolt-tag-picker-add-icon-div">
        <input role="combobox" aria-labelledby="${labelId}" class="bolt-tag-picker-input" value="">
      </div>
    </div></div><div class="bolt-identity-picker-error"></div></div>
  </div>`;
}

function page(optional: string[], required: string[] | null): string {
  return `<!doctype html><body><div class="flex-column">
    ${reviewerField("__bolt-pr-optional-reviewers-label", "Reviewers", optional)}
    ${required === null ? "" : reviewerField("__bolt-pr-required-reviewers-label", "Required reviewers", required)}
  </div><div class="bolt-portal-host"></div></body>`;
}

/** How the stand-in field takes a suggestion: on mouse down, as a click starts, or on Enter for the highlighted one. */
type SelectOn = "mousedown" | "enter";

interface PickerOptions {
  found?: typeof DIRECTORY;
  selectOn?: SelectOn;
}

function createOption(
  document: Document,
  { name, detail }: (typeof DIRECTORY)[number],
  index: number,
): HTMLElement {
  const option = document.createElement("div");
  option.id = `suggestion-row-${index}`;
  option.setAttribute("role", "option");
  option.innerHTML = `<div class="bolt-suggestions-item"><div class="bolt-picker-persona-name">
    <div class="fontSizeM text-ellipsis">${name}</div>
    <div class="flex-row"><div class="fontSize secondary-text">${detail}</div></div></div></div>`;
  return option;
}

interface Suggestions {
  found: typeof DIRECTORY;
  listboxId: string;
  selectOn: SelectOn;
  take: (name: string) => void;
}

/** The suggestions for what the input holds, the first one highlighted. */
function showSuggestions(
  input: HTMLInputElement,
  { found, listboxId, selectOn, take }: Suggestions,
): void {
  const { ownerDocument: document } = input;
  const query = input.value.toLowerCase();
  document.querySelector(`#${listboxId}`)?.remove();
  const listbox = document.createElement("div");
  listbox.id = listboxId;
  listbox.setAttribute("role", "listbox");
  const matches = found.filter(
    ({ name, detail }) =>
      name.toLowerCase().includes(query) || detail.toLowerCase().includes(query),
  );
  for (const [index, match] of matches.entries()) {
    const option = createOption(document, match, index);
    option.querySelector(".bolt-suggestions-item")?.addEventListener("mousedown", () => {
      if (selectOn === "mousedown") {
        take(match.name);
      }
    });
    listbox.append(option);
  }
  input.setAttribute("aria-activedescendant", "suggestion-row-0");
  document.querySelector(".bolt-portal-host")?.append(listbox);
}

/**
 * Azure DevOps's reviewer field, as far as the chips use it: typing shows suggestions
 * in a listbox after a moment, the first one highlighted, and taking one adds it as a pill.
 * A click alone takes nothing.
 */
function attachPicker(
  document: Document,
  labelId: string,
  { found = DIRECTORY, selectOn = "mousedown" }: PickerOptions = {},
): void {
  const input = document.querySelector<HTMLInputElement>(`input[aria-labelledby="${labelId}"]`);
  const list = document.querySelector(`[role="list"][aria-labelledby="${labelId}"]`);
  if (input === null || list === null) {
    return;
  }
  const listboxId = `suggestions-${labelId}`;
  input.setAttribute("aria-controls", listboxId);
  const take = (name: string): void => {
    list.insertAdjacentHTML("beforeend", pill(name));
    input.value = "";
    input.removeAttribute("aria-activedescendant");
    document.querySelector(`#${listboxId}`)?.remove();
  };
  input.addEventListener("keydown", (event) => {
    const active = input.getAttribute("aria-activedescendant");
    const name =
      active === null ? null : document.querySelector(`#${active} .fontSizeM`)?.textContent;
    if (selectOn === "enter" && event.key === "Enter" && name !== null && name !== undefined) {
      take(name);
    }
  });
  input.addEventListener("input", () => {
    setImmediate(() => {
      showSuggestions(input, { found, listboxId, selectOn, take });
    });
  });
}

export { attachPicker, page, pill };
