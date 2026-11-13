// The menu under a starred reviewer's arrow, with "Add as required reviewer".
// It opens below the arrow and closes on a click outside it, on Escape or on a scroll.
import { createMenu } from "./starred-reviewers-markup.ts";
import { isElement } from "./closest-element.ts";

const MENU_GAP_PX = 4;

/** Below the button, in page coordinates, so the menu scrolls with the page. */
function placeUnder(menu: HTMLElement, button: Element): void {
  const { bottom, left } = button.getBoundingClientRect();
  const view = button.ownerDocument.defaultView;
  menu.style.top = `${bottom + (view?.scrollY ?? 0) + MENU_GAP_PX}px`;
  menu.style.left = `${left + (view?.scrollX ?? 0)}px`;
}

function showMenu(document: Document, menu: HTMLElement, button: Element): void {
  placeUnder(menu, button);
  button.setAttribute("aria-expanded", "true");
  document.body.append(menu);
}

/** Opens the menu under `button`. Returns a function that closes it. */
function openAddReviewerMenu(
  document: Document,
  button: Element,
  onAddAsRequired: () => void,
): () => void {
  const { menu, item } = createMenu(document, "Add as required reviewer");

  function onOutside(event: Event): void {
    if (!isElement(event.target) || !menu.contains(event.target)) {
      close();
    }
  }
  function onEscape(event: Event): void {
    if ("key" in event && event.key === "Escape") {
      close();
    }
  }
  // A scroll in any of the page's containers moves the arrow away, so the menu closes.
  const listeners: [string, (event: Event) => void][] = [
    ["mousedown", onOutside],
    ["keydown", onEscape],
    ["scroll", close],
  ];
  function close(): void {
    menu.remove();
    button.setAttribute("aria-expanded", "false");
    for (const [type, listener] of listeners) {
      document.removeEventListener(type, listener, true);
    }
  }

  item.addEventListener("click", () => {
    close();
    onAddAsRequired();
  });
  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener, true);
  }
  showMenu(document, menu, button);
  return close;
}

export { openAddReviewerMenu };
