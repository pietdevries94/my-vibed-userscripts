// A stand-in for the single-file view's code editor, held by the framework above the
// editor's element as on the real page. Test code only.
import type { CodeEditor, EditorOverlay, EditorZone, ZoneChanges } from "./code-editor.ts";
import assert from "node:assert/strict";

interface FakeEditors {
  /** The room each editor keeps, by side. */
  zones: Record<"left" | "right", EditorZone[]>;
  /** The elements the editors show over the code. */
  overlays: HTMLElement[];
  /** Shows another file in both editors. */
  showAnotherFile: () => void;
  /** Scrolls the editors: every room is drawn this much higher. */
  scrollBy: (pixels: number) => void;
}

const LINE_HEIGHT = 18;
const WIDE = 900;
/** The editor before the change in an inline diff. */
const NARROW = 54;

interface FakeEditorOptions {
  document: Document;
  zones: EditorZone[];
  contentWidth: number;
  model: () => unknown;
}

function fakeEditor({ contentWidth, document, model, zones }: FakeEditorOptions): CodeEditor {
  const changes: ZoneChanges = {
    addZone: (zone) => {
      zones.push(zone);
      zone.onDomNodeTop(zone.afterLineNumber * LINE_HEIGHT);
      return zone;
    },
    layoutZone: () => {
      // The stand-in has no layout.
    },
    removeZone: (id) => {
      const ids: unknown[] = zones;
      zones.splice(ids.indexOf(id), 1);
    },
  };
  return {
    addOverlayWidget: (overlay: EditorOverlay) => {
      document.body.append(overlay.getDomNode());
    },
    changeViewZones: (change) => {
      change(changes);
    },
    getLayoutInfo: () => ({ contentLeft: 74, contentWidth }),
    getModel: model,
    removeOverlayWidget: (overlay: EditorOverlay) => {
      overlay.getDomNode().remove();
    },
  };
}

/** Gives the captured single-file view a diff editor the script can reach. */
function attachFakeEditors(document: Document, isInline = true): FakeEditors {
  const element = document.querySelector(".vss-base-editor");
  assert.ok(element !== null);
  const zones: FakeEditors["zones"] = { left: [], right: [] };
  let file = {};
  const model = (): unknown => file;
  const right = fakeEditor({ contentWidth: WIDE, document, model, zones: zones.right });
  const left = fakeEditor({
    contentWidth: isInline ? NARROW : WIDE,
    document,
    model,
    zones: zones.left,
  });
  const diffEditor = {
    getModifiedEditor: (): CodeEditor => right,
    getOriginalEditor: (): CodeEditor => left,
  };
  Object.assign(element, {
    __reactFiber$test: { return: { return: null, stateNode: { editor: diffEditor } } },
  });
  return {
    get overlays() {
      return [...document.querySelectorAll<HTMLElement>(".fix-ado-review-editor-card")];
    },
    scrollBy: (pixels) => {
      for (const zone of [...zones.left, ...zones.right]) {
        zone.onDomNodeTop(zone.afterLineNumber * LINE_HEIGHT - pixels);
      }
    },
    showAnotherFile: () => {
      file = {};
    },
    zones,
  };
}

export type { FakeEditors };
export { attachFakeEditors };
