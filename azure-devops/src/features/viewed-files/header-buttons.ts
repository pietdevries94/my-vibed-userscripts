// The Expand all and Collapse viewed buttons in the pull request's header, right
// before the vote button. They act on the file cards and the file tree of the Files tab.
const VOTE_BUTTON_SELECTOR = ".repos-pr-header-vote-button";
const BOX_CLASS = "fix-ado-viewed-header-buttons";

/** What a header button does. */
type HeaderAction = "expand-all" | "collapse-viewed";

const HEADER_BUTTONS: { action: HeaderAction; label: string }[] = [
  { action: "expand-all", label: "Expand all" },
  { action: "collapse-viewed", label: "Collapse viewed" },
];

/** What a click on a header button does now. A button reads it on each click. */
const onClickByDocument = new WeakMap<Document, (action: HeaderAction) => void>();

function createButton(
  document: Document,
  { action, label }: { action: HeaderAction; label: string },
): HTMLButtonElement {
  const text = Object.assign(document.createElement("span"), {
    className: "bolt-button-text body-m",
    textContent: label,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bolt-button enabled bolt-focus-treatment";
  button.append(text);
  button.addEventListener("click", () => {
    onClickByDocument.get(document)?.(action);
  });
  return button;
}

/** Shows the header buttons before the vote button, and sets what their clicks do. */
function syncHeaderButtons(document: Document, onClick: (action: HeaderAction) => void): void {
  onClickByDocument.set(document, onClick);
  const vote = document.querySelector(VOTE_BUTTON_SELECTOR);
  if (vote === null || vote.previousElementSibling?.classList.contains(BOX_CLASS) === true) {
    return;
  }
  document.querySelector(`.${BOX_CLASS}`)?.remove();
  const box = Object.assign(document.createElement("div"), {
    className: `${BOX_CLASS} inline-flex-row rhythm-horizontal-8`,
  });
  box.append(...HEADER_BUTTONS.map((headerButton) => createButton(document, headerButton)));
  vote.before(box);
}

/** Takes the header buttons away, as when the Files tab is not shown. */
function removeHeaderButtons(document: Document): void {
  document.querySelector(`.${BOX_CLASS}`)?.remove();
}

export { removeHeaderButtons, syncHeaderButtons };
export type { HeaderAction };
