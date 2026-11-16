// The cards of the pending comments in the single-file view. The code editor keeps
// room free under the comment's line, and shows the card over that room, as Azure
// DevOps does for its own threads.
import type { CodeEditor, EditorOverlay, EditorZone, ShownEditors } from "./code-editor.ts";
import { ONLY_YOU_NOTE, createCard, markHolder } from "./pending-card.ts";
import type { ShownComment } from "./pending-card.ts";
import { element } from "./review-markup.ts";
import { findShownEditors } from "./code-editor.ts";
import { shownFilePath } from "./editor-comment-boxes.ts";

/** A card the editor shows, with what it was made for. */
interface EditorCard {
  editor: CodeEditor;
  /** The file the editor showed when the card was placed. */
  model: unknown;
  content: string;
  /** True when the card shows an edit in progress. */
  isEditing: boolean;
  overlay: EditorOverlay;
  /** The card inside the overlay. A click on "Delete comment" or "Update comment" removes it. */
  item: HTMLElement;
  /** Takes the card and its room out of the editor. */
  remove: () => void;
}

/** The room the editor keeps free for one card. */
interface Room {
  resize: (height: number) => void;
  remove: () => void;
}

const OVERLAY_CLASS = "fix-ado-review-editor-card";
const MAX_CARD_WIDTH = 744;
const CARD_MARGIN = 16;
/** The editor before the change is this narrow when the diff shows inline: no room for a card. */
const MIN_EDITOR_WIDTH = 200;

const cardsByDocument = new WeakMap<Document, Map<string, EditorCard>>();

function cardsOf(document: Document): Map<string, EditorCard> {
  const cards = cardsByDocument.get(document) ?? new Map<string, EditorCard>();
  cardsByDocument.set(document, cards);
  return cards;
}

function createItem(document: Document, comment: ShownComment): HTMLElement {
  const item = element(document, "div", { className: "fix-ado-review-listed" });
  markHolder(item, comment);
  item.append(createCard(document, comment, ONLY_YOU_NOTE));
  return item;
}

/** Shows the card at the place the editor drew its room. */
function showAt(card: HTMLElement, editor: CodeEditor, top: number): void {
  const { contentLeft, contentWidth } = editor.getLayoutInfo();
  Object.assign(card.style, {
    display: "block",
    left: `${contentLeft}px`,
    top: `${top}px`,
    width: `${Math.min(MAX_CARD_WIDTH, contentWidth - CARD_MARGIN)}px`,
  });
}

function doNothing(): void {
  // Nothing was started, so nothing stops.
}

/** Keeps the room as tall as the card, also when the owner edits it. */
function keepRoomFor(card: HTMLElement, resize: (height: number) => void): () => void {
  const view = card.ownerDocument.defaultView;
  // A test page has no ResizeObserver.
  if (view === null || !("ResizeObserver" in view)) {
    return doNothing;
  }
  const observer = new view.ResizeObserver(() => {
    resize(card.getBoundingClientRect().height);
  });
  observer.observe(card);
  return () => {
    observer.disconnect();
  };
}

/** Hides the card when the editor hides its room: the line scrolled out of view. */
function hideWithRoom(card: HTMLElement, room: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  if (view === null) {
    return doNothing;
  }
  const observer = new view.MutationObserver(() => {
    if (room.style.display === "none") {
      card.style.display = "none";
    }
  });
  observer.observe(room, { attributeFilter: ["style"], attributes: true });
  return () => {
    observer.disconnect();
  };
}

/** Asks the editor for room under the line, as tall as the card, and returns how to change it. */
function addRoom(editor: CodeEditor, zone: EditorZone): Room {
  let zoneId: unknown = null;
  editor.changeViewZones((changes) => {
    zoneId = changes.addZone(zone);
  });
  return {
    remove: () => {
      editor.changeViewZones((changes) => {
        changes.removeZone(zoneId);
      });
    },
    resize: (height) => {
      if (Math.abs(height - zone.heightInPx) >= 1) {
        zone.heightInPx = height;
        editor.changeViewZones((changes) => {
          changes.layoutZone(zoneId);
        });
      }
    },
  };
}

interface ShownOverlay {
  card: HTMLElement;
  item: HTMLElement;
  overlay: EditorOverlay;
}

/** A pending comment that belongs in the editor on the page, with its editor and line. */
interface WantedCard {
  comment: ShownComment;
  editor: CodeEditor;
  line: number;
}

/** The card's element, shown by the editor over the code. */
function showOverlay(document: Document, { comment, editor }: WantedCard): ShownOverlay {
  const card = element(document, "div", { className: `${OVERLAY_CLASS} body-m` });
  const item = createItem(document, comment);
  card.append(item);
  const overlay: EditorOverlay = {
    getDomNode: () => card,
    getId: () => `fix-ado-review-${comment.id}`,
    getPosition: () => null,
  };
  editor.addOverlayWidget(overlay);
  return { card, item, overlay };
}

function placeCard(document: Document, wanted: WantedCard): EditorCard {
  const { comment, editor, line } = wanted;
  const { card, item, overlay } = showOverlay(document, wanted);
  const { height } = card.getBoundingClientRect();
  const zone: EditorZone = {
    afterLineNumber: line,
    domNode: element(document, "div"),
    heightInPx: height,
    onDomNodeTop: (top) => {
      showAt(card, editor, top);
    },
  };
  const room = addRoom(editor, zone);
  const stops = [keepRoomFor(card, room.resize), hideWithRoom(card, zone.domNode)];
  const remove = (): void => {
    for (const stop of stops) {
      stop();
    }
    room.remove();
    editor.removeOverlayWidget(overlay);
  };
  const { content, draft } = comment;
  return {
    content,
    editor,
    isEditing: draft !== null,
    item,
    model: editor.getModel(),
    overlay,
    remove,
  };
}

function removeCard(card: EditorCard): void {
  try {
    card.remove();
  } catch {
    // The editor is gone, and its cards with it.
  }
}

/** The editor a comment on this side goes in, or null when that editor has no room for a card. */
function editorFor({ left, right }: ShownEditors, side: "left" | "right"): CodeEditor | null {
  if (side === "right") {
    return right;
  }
  return left !== null && left.getLayoutInfo().contentWidth >= MIN_EDITOR_WIDTH ? left : null;
}

/** The pending comments on the file the editor shows, by id. None in a view without an editor. */
function wantedCards(document: Document, pending: ShownComment[]): Map<string, WantedCard> {
  const editors = findShownEditors(document);
  const filePath = shownFilePath(document);
  const wanted = new Map<string, WantedCard>();
  for (const comment of editors === null ? [] : pending) {
    const { anchor } = comment;
    const editor =
      editors !== null && anchor?.filePath === filePath ? editorFor(editors, anchor.side) : null;
    if (anchor !== null && editor !== null) {
      wanted.set(comment.id, { comment, editor, line: anchor.line });
    }
  }
  return wanted;
}

/** True when the card still shows this comment in this editor, on the file it was placed in. */
function isCurrent(card: EditorCard, { comment, editor }: WantedCard): boolean {
  return (
    card.editor === editor &&
    card.model === editor.getModel() &&
    card.content === comment.content &&
    card.isEditing === (comment.draft !== null) &&
    card.item.isConnected
  );
}

/** Removes the cards that show something else than what is wanted now. */
function removeOutdated(cards: Map<string, EditorCard>, wanted: Map<string, WantedCard>): void {
  for (const [id, card] of cards) {
    const want = wanted.get(id);
    if (want === undefined || !isCurrent(card, want)) {
      removeCard(card);
      cards.delete(id);
    }
  }
}

/**
 * Shows a card under the line of every pending comment on the file in the single-file
 * view, and removes the others. Returns the ids of the comments that have a card.
 */
function syncEditorCards(document: Document, pending: ShownComment[]): Set<string> {
  const cards = cardsOf(document);
  const wanted = wantedCards(document, pending);
  removeOutdated(cards, wanted);
  for (const [id, want] of wanted) {
    if (!cards.has(id)) {
      cards.set(id, placeCard(document, want));
    }
  }
  return new Set(cards.keys());
}

export { syncEditorCards };
