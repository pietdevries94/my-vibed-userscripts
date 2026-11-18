// Keeps focus in the starred reviewers list when it is filled again, so it does not fall
// to the page: on the same button of the same row, else that button of the next row,
// else the "Star someone" button.

const ROW_ATTRIBUTE = "data-fix-ado-identity";
const STAR_SOMEONE_SELECTOR = ".fix-ado-star-someone";

/** The selector of a row's button that matches the focused one: its star, + or required button. */
function buttonSelectorOf(control: Element): string | null {
  const add = control.closest<HTMLElement>("[data-fix-ado-add]")?.dataset.fixAdoAdd;
  if (add !== undefined) {
    return `[data-fix-ado-add="${add}"]`;
  }
  return control.closest(".fix-ado-star") === null ? null : ".fix-ado-star";
}

/** The ids of the rows from the focused one on, when a row button of `list` has focus. */
function rowsFromFocused(list: HTMLElement): string[] {
  const row = list.ownerDocument.activeElement?.closest(`[${ROW_ATTRIBUTE}]`) ?? null;
  if (row === null || !list.contains(row)) {
    return [];
  }
  const ids = [...list.querySelectorAll(`[${ROW_ATTRIBUTE}]`)].map(
    (candidate) => candidate.getAttribute(ROW_ATTRIBUTE) ?? "",
  );
  return ids.slice(ids.indexOf(row.getAttribute(ROW_ATTRIBUTE) ?? ""));
}

/**
 * Notes which row button has focus before `list` is filled again. The function it returns
 * runs after: it focuses the matching button in the new rows.
 */
function keepListFocus(list: HTMLElement): () => void {
  const { activeElement } = list.ownerDocument;
  const selector = activeElement === null ? null : buttonSelectorOf(activeElement);
  const nearest = selector === null ? [] : rowsFromFocused(list);
  return () => {
    if (nearest.length === 0) {
      return;
    }
    const buttons = nearest.map((id) =>
      list.querySelector<HTMLElement>(`[${ROW_ATTRIBUTE}="${id}"] ${selector ?? ""}`),
    );
    const target =
      buttons.find((button) => button !== null) ??
      list.ownerDocument.querySelector<HTMLElement>(STAR_SOMEONE_SELECTOR);
    target?.focus();
  };
}

export { keepListFocus };
