// The create pull request page's reviewer field on the fake site. The capture holds the
// field but not Azure DevOps's code, so this script stands in for it: typing searches the
// fake identity API and shows suggestions, pressing on one adds it as a pill, and the
// required reviewers toggle adds a required field.

/** The page's script, as text for the fixture page. */
const CREATE_PAGE_SCRIPT = String.raw`
  const FIELD_INPUT = ".bolt-tag-picker-input";
  const SUGGESTIONS_ID = "fake-reviewer-suggestions";
  const OPTIONAL_LABEL_ID = "__bolt-pr-optional-reviewers-label";
  const REQUIRED_LABEL_ID = "__bolt-pr-required-reviewers-label";

  function closeSuggestions() {
    document.querySelector("#" + SUGGESTIONS_ID)?.remove();
  }

  function addPill(input, name) {
    const labelId = input.getAttribute("aria-labelledby");
    const list = document.querySelector('[role="list"][aria-labelledby="' + labelId + '"]');
    const pill = document.createElement("div");
    pill.className = "bolt-identity-picker-pill flex-row bolt-tag-picker-pill bolt-pill flex-center standard regular";
    pill.setAttribute("role", "listitem");
    pill.innerHTML = '<div class="text-ellipsis bolt-pill-content"></div>';
    pill.firstElementChild.textContent = name;
    list?.append(pill);
    input.value = "";
    closeSuggestions();
  }

  function createOption(input, identity) {
    const name = identity.displayName.replace(/^\[[^\]]*\]\\/u, "");
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.innerHTML =
      '<div class="bolt-suggestions-item flex-row cursor-pointer" style="padding: 6px 12px">' +
      '<div class="bolt-picker-persona-name flex-column"><div class="fontSizeM text-ellipsis"></div>' +
      '<div class="flex-row"><div class="fontSize secondary-text text-ellipsis"></div></div></div></div>';
    option.querySelector(".fontSizeM").textContent = name;
    option.querySelector(".secondary-text").textContent = identity.signInAddress ?? "";
    // Azure DevOps's field picks on mouse down, not on click.
    option.querySelector(".bolt-suggestions-item").addEventListener("mousedown", () => {
      addPill(input, name);
    });
    return option;
  }

  async function suggest(input) {
    const query = input.value.trim();
    closeSuggestions();
    if (query === "") {
      return;
    }
    const response = await fetch("/fake-org/_apis/IdentityPicker/Identities", {
      body: JSON.stringify({ query }),
      method: "POST",
    });
    const { results } = await response.json();
    if (input.value.trim() !== query) {
      return;
    }
    const listbox = document.createElement("div");
    listbox.id = SUGGESTIONS_ID;
    listbox.setAttribute("role", "listbox");
    const box = input.getBoundingClientRect();
    listbox.style.cssText =
      "position: absolute; z-index: 1000; width: 400px; left: " + (box.left + scrollX) +
      "px; top: " + (box.bottom + scrollY) +
      "px; background: var(--callout-background-color, #fff); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);";
    listbox.append(...(results[0]?.identities ?? []).map((identity) => createOption(input, identity)));
    input.setAttribute("aria-controls", SUGGESTIONS_ID);
    document.body.append(listbox);
  }

  function showRequiredField() {
    const optional = document.querySelector("#" + OPTIONAL_LABEL_ID)?.parentElement?.parentElement;
    if (optional === undefined || document.querySelector("#" + REQUIRED_LABEL_ID) !== null) {
      return;
    }
    const required = optional.cloneNode(true);
    required.querySelector(".bolt-header-commandbar")?.remove();
    required.querySelector(".fix-ado-starred-chips")?.remove();
    for (const pill of required.querySelectorAll(".bolt-identity-picker-pill")) {
      pill.remove();
    }
    const label = required.querySelector("label");
    label.id = REQUIRED_LABEL_ID;
    label.textContent = "Required reviewers";
    for (const labelled of required.querySelectorAll("[aria-labelledby]")) {
      labelled.setAttribute("aria-labelledby", REQUIRED_LABEL_ID);
    }
    optional.after(required);
  }

  document.addEventListener("input", (event) => {
    if (event.target.matches?.(FIELD_INPUT)) {
      void suggest(event.target);
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#__bolt-toggle-required-reviewers")) {
      showRequiredField();
    }
  });
`;

export { CREATE_PAGE_SCRIPT };
