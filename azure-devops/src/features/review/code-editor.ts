// The code editor of the single-file view, reached through the page: the framework
// keeps the editor on a node above the editor's element. Only the editor itself can
// make room under a line, so a pending card there needs it.

/** Room the editor keeps free under a line. */
interface EditorZone {
  afterLineNumber: number;
  heightInPx: number;
  /** The editor keeps this element in the room, and hides it out of view. */
  domNode: HTMLElement;
  /** The editor calls this with the room's place in the editor, each time it draws the room. */
  onDomNodeTop: (top: number) => void;
}

interface ZoneChanges {
  addZone: (zone: EditorZone) => unknown;
  removeZone: (id: unknown) => void;
  /** Reads the zone's height again. */
  layoutZone: (id: unknown) => void;
}

/** An element the editor shows over the code, which takes clicks and typing. */
interface EditorOverlay {
  getId: () => string;
  getDomNode: () => HTMLElement;
  /** Null: the script places the element itself. */
  getPosition: () => null;
}

interface CodeEditor {
  changeViewZones: (change: (changes: ZoneChanges) => void) => void;
  addOverlayWidget: (overlay: EditorOverlay) => void;
  removeOverlayWidget: (overlay: EditorOverlay) => void;
  /** The file the editor shows. Another file is another model. */
  getModel: () => unknown;
  getLayoutInfo: () => { contentLeft: number; contentWidth: number };
}

/** The editors of the single-file view: the file after the change, and before it in a diff. */
interface ShownEditors {
  right: CodeEditor;
  left: CodeEditor | null;
}

const EDITOR_ELEMENT_SELECTOR = ".vss-base-editor";
const FRAMEWORK_KEY_PREFIX = "__reactFiber";
const HOLDER_KEYS = ["stateNode", "memoizedProps"];
const EDITOR_FUNCTIONS = [
  "changeViewZones",
  "addOverlayWidget",
  "removeOverlayWidget",
  "getModel",
  "getLayoutInfo",
];
/** How far above the editor's element the framework may keep the editor. */
const MAX_LEVELS = 30;

function property(target: unknown, key: string): unknown {
  const isHolder = (typeof target === "object" || typeof target === "function") && target !== null;
  return isHolder ? Reflect.get(target, key) : undefined;
}

function ownKeys(target: unknown): string[] {
  return typeof target === "object" && target !== null ? Object.keys(target) : [];
}

function asCodeEditor(candidate: unknown): CodeEditor | null {
  const isEditor = EDITOR_FUNCTIONS.every(
    (name) => typeof property(candidate, name) === "function",
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- it has every function the script calls
  return isEditor ? (candidate as CodeEditor) : null;
}

/** The editor one half of a diff editor gives, or null when it gives none. */
function halfOf(diffEditor: unknown, getter: string): CodeEditor | null {
  const get = property(diffEditor, getter);
  return typeof get === "function" ? asCodeEditor(Reflect.apply(get, diffEditor, [])) : null;
}

/** The editors a value stands for: a diff editor's two halves, or one editor. */
function asShownEditors(candidate: unknown): ShownEditors | null {
  const right = halfOf(candidate, "getModifiedEditor") ?? asCodeEditor(candidate);
  return right === null ? null : { left: halfOf(candidate, "getOriginalEditor"), right };
}

/** The editors one framework node holds, or null when it holds none. */
function editorsHeldBy(node: unknown): ShownEditors | null {
  for (const holderKey of HOLDER_KEYS) {
    const holder = property(node, holderKey);
    for (const key of ownKeys(holder)) {
      const editors = asShownEditors(property(holder, key));
      if (editors !== null) {
        return editors;
      }
    }
  }
  return null;
}

/** The editors of the single-file view, or null when the page shows or gives none. */
function findShownEditors(document: Document): ShownEditors | null {
  const element = document.querySelector(EDITOR_ELEMENT_SELECTOR);
  const nodeKey = ownKeys(element).find((key) => key.startsWith(FRAMEWORK_KEY_PREFIX));
  let node = nodeKey === undefined ? undefined : property(element, nodeKey);
  for (let level = 0; level < MAX_LEVELS && node !== undefined && node !== null; level += 1) {
    const editors = editorsHeldBy(node);
    if (editors !== null) {
      return editors;
    }
    node = property(node, "return");
  }
  return null;
}

export type { CodeEditor, EditorOverlay, EditorZone, ShownEditors, ZoneChanges };
export { findShownEditors };
