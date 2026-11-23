// The right pane of the fake Files tab: a card per file, or the bar above a single
// file. Test code only.
const CARD_MARKUP = `<div class="flex-row"><button class="bolt-card-expand-button" aria-expanded="true"></button><div class="flex-row flex-grow"><div class="flex-column"><div role="heading"><span class="text-ellipsis"></span></div><div class="body-s secondary-text text-ellipsis"></div></div><div class="flex-row flex-grow justify-end"><a class="bolt-link-button">View</a></div></div></div>`;
const BAR_MARKUP = `<div class="secondary-text text-ellipsis"></div><div class="bolt-split-button"></div>`;

function card(document: Document, path: string, isOpen = true): HTMLElement {
  const header = document.createElement("div");
  header.className = "repos-summary-header bolt-card";
  header.innerHTML = CARD_MARKUP;
  header.querySelector("[role=heading] .text-ellipsis")?.append(path.split("/").at(-1) ?? "");
  header.querySelector(".secondary-text")?.append(path);
  const expand = header.querySelector<HTMLElement>(".bolt-card-expand-button");
  expand?.setAttribute("aria-expanded", String(isOpen));
  expand?.addEventListener("click", () => {
    expand.setAttribute("aria-expanded", String(expand.getAttribute("aria-expanded") !== "true"));
  });
  return header;
}

/** The bar above the single-file view, for the file at `path`. */
function fileBar(document: Document, path: string): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "repos-compare-toolbar";
  bar.innerHTML = BAR_MARKUP;
  bar.querySelector(".secondary-text")?.append(path);
  return bar;
}

/** Fills the right pane: a card per file, or the bar of the open file. */
function fillViewer(document: Document, changedPaths: string[], openFile?: string): void {
  const viewer = document.querySelector(".repos-changes-viewer");
  if (openFile === undefined) {
    viewer?.classList.add("is-folder");
    viewer?.append(...changedPaths.map((path) => card(document, path)));
  } else {
    viewer?.before(fileBar(document, openFile));
  }
}

function redrawCard(document: Document, path: string, isOpen: boolean): void {
  const old = [...document.querySelectorAll(".repos-summary-header")].find(
    (header) => header.querySelector(".secondary-text")?.textContent === path,
  );
  const fresh = card(document, path, isOpen);
  if (old === undefined) {
    document.querySelector(".repos-changes-viewer")?.append(fresh);
  } else {
    old.replaceWith(fresh);
  }
}

/** Shows another file in the bar, changing its text in place as React does. */
function showFileInBar(document: Document, path: string): void {
  const text = document.querySelector(".repos-compare-toolbar .secondary-text")?.firstChild;
  if (text !== null && text !== undefined) {
    text.nodeValue = path;
  }
}

export { fillViewer, redrawCard, showFileInBar };
