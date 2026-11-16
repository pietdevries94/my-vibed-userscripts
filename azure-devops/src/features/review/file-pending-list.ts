// The pending comments on the file in the single-file view that have no card under
// their line, as a list in a corner of the code editor. That is every comment when the
// script cannot reach the editor, and a comment on a removed line in an inline diff.
import { createCard, markHolder } from "./pending-card.ts";
import { element, pendingCountText } from "./review-markup.ts";
import type { ShownComment } from "./pending-card.ts";
import { shownFilePath } from "./editor-comment-boxes.ts";

const LIST_CLASS = "fix-ado-review-file-pending";
const ITEM_CLASS = "fix-ado-review-listed";
/** The single-file view's code editor: a diff, or one file for an added or deleted file. */
const EDITOR_SELECTOR = ".monaco-diff-editor, .monaco-editor";
/** The card around the editor, which the list is placed in. */
const EDITOR_CARD_SELECTOR = ".bolt-card-content";

/** Where the list goes: the card around the code editor. Null in a view without an editor. */
function listHost(document: Document): Element | null {
  const editor = document.querySelector(EDITOR_SELECTOR);
  return editor?.closest(EDITOR_CARD_SELECTOR) ?? editor?.parentElement ?? null;
}

function lineLabel({ anchor }: ShownComment): string {
  if (anchor === null) {
    return "";
  }
  return anchor.side === "left" ? `Line ${anchor.line}, before the change` : `Line ${anchor.line}`;
}

function listItem(document: Document, comment: ShownComment): HTMLElement {
  const item = element(document, "div", { className: ITEM_CLASS });
  markHolder(item, comment);
  item.append(createCard(document, comment, lineLabel(comment)));
  return item;
}

function createList(document: Document, inFile: ShownComment[], isOpen: boolean): HTMLElement {
  const list = element(document, "details", { className: `${LIST_CLASS} body-m` });
  list.open = isOpen;
  list.append(
    element(document, "summary", { text: `${pendingCountText(inFile.length)} in this file` }),
    ...inFile.map((comment) => listItem(document, comment)),
  );
  return list;
}

/** The pending comments on the file the single-file view shows. None in another view. */
function pendingInShownFile(document: Document, pending: ShownComment[]): ShownComment[] {
  const filePath = shownFilePath(document);
  return listHost(document) === null
    ? []
    : pending.filter(({ anchor }) => anchor?.filePath === filePath);
}

/** True when the list on the page shows exactly these comments. */
function showsExactly(list: HTMLElement | null, shown: string, count: number): boolean {
  return (
    list?.dataset.fixAdoReviewShown === shown &&
    list.parentElement === listHost(list.ownerDocument) &&
    list.querySelectorAll(`.${ITEM_CLASS}`).length === count
  );
}

/** Shows the list in the single-file view, rebuilt only when what it shows changes. */
function syncFilePendingList(document: Document, pending: ShownComment[]): void {
  const inFile = pendingInShownFile(document, pending);
  const existing = document.querySelector<HTMLDetailsElement>(`.${LIST_CLASS}`);
  const shown = JSON.stringify(
    inFile.map(({ content, draft, id }) => [id, content, draft !== null]),
  );
  if (inFile.length === 0) {
    existing?.remove();
  } else if (!showsExactly(existing, shown, inFile.length)) {
    const list = createList(document, inFile, existing?.open ?? false);
    list.dataset.fixAdoReviewShown = shown;
    existing?.remove();
    listHost(document)?.append(list);
  }
}

export { syncFilePendingList };
