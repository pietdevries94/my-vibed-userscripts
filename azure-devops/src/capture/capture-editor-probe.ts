// What the page offers a script that wants room under a line in the single-file
// view's code editor: whether the editor's API is reachable, and by which route. The
// probe records names of the page's own code and counts, never content. Dev file only.

interface EditorProbe {
  /** False when the script cannot reach the page's own objects. */
  hasPageWindow: boolean;
  /** "object" when the page has the editor library as a global. */
  monacoType: string;
  /** The functions of the library's editor API, by name. */
  editorFunctions: string[];
  /** How many editors the library lists. Null when it has no such list. */
  editorCount: number | null;
  diffEditorCount: number | null;
  /** The kinds of the page's module loader: `require` and `define`. */
  loaderTypes: string[];
  /** The kinds of keys the page's framework put on the editor's element. */
  elementKeyKinds: string[];
  /** Where an editor was found from the editor's element, as "level:holder.key:kind". */
  editorRoutes: string[];
  /** The name of what went wrong, when the probe failed. */
  failure: string | null;
}

const EDITOR_ELEMENT_SELECTOR = ".vss-base-editor, .monaco-diff-editor, .monaco-editor";
const HOLDER_KEYS = ["stateNode", "memoizedProps", "memoizedState"];
const MAX_LEVELS = 60;
const MAX_NAMES = 80;

function property(target: unknown, key: string): unknown {
  const isHolder = (typeof target === "object" || typeof target === "function") && target !== null;
  return isHolder ? Reflect.get(target, key) : undefined;
}

function ownKeys(target: unknown): string[] {
  return typeof target === "object" && target !== null ? Object.keys(target) : [];
}

/** "diff" or "code" for an editor of the library, null for anything else. */
function editorKind(candidate: unknown): string | null {
  if (typeof property(candidate, "getModifiedEditor") === "function") {
    return "diff";
  }
  return typeof property(candidate, "changeViewZones") === "function" ? "code" : null;
}

/** How many items a list function of the editor API returns. Null without that function. */
function listLength(editorApi: unknown, name: string): number | null {
  const list = property(editorApi, name);
  const items: unknown = typeof list === "function" ? Reflect.apply(list, editorApi, []) : null;
  return Array.isArray(items) ? items.length : null;
}

/** The editors one framework node holds, one level deep, as "holder.key:kind". */
function editorsHeldBy(node: unknown): string[] {
  return HOLDER_KEYS.flatMap((holderKey) => {
    const holder = property(node, holderKey);
    return ownKeys(holder).flatMap((key) => {
      const kind = editorKind(property(holder, key));
      return kind === null ? [] : [`${holderKey}.${key}:${kind}`];
    });
  });
}

/** Walks up the framework's tree from the editor's element, and lists where an editor is held. */
function editorRoutesFrom(element: Element | null): string[] {
  const nodeKey = ownKeys(element).find((key) => key.startsWith("__react"));
  let node = nodeKey === undefined ? undefined : property(element, nodeKey);
  const routes: string[] = [];
  for (let level = 0; level < MAX_LEVELS && node !== undefined && node !== null; level += 1) {
    routes.push(...editorsHeldBy(node).map((route) => `${level}:${route}`));
    node = property(node, "return");
  }
  return routes;
}

function probeOf(pageWindow: unknown, element: Element | null): Omit<EditorProbe, "failure"> {
  const monaco = property(pageWindow, "monaco");
  const editorApi = property(monaco, "editor");
  return {
    diffEditorCount: listLength(editorApi, "getDiffEditors"),
    editorCount: listLength(editorApi, "getEditors"),
    editorFunctions: ownKeys(editorApi)
      .filter((key) => typeof property(editorApi, key) === "function")
      .slice(0, MAX_NAMES),
    editorRoutes: editorRoutesFrom(element).slice(0, MAX_NAMES),
    elementKeyKinds: [...new Set(ownKeys(element).map((key) => key.split("$")[0] ?? ""))],
    hasPageWindow: pageWindow !== undefined,
    loaderTypes: ["require", "define"].map((name) => typeof property(pageWindow, name)),
    monacoType: typeof monaco,
  };
}

/** Probes the page for its code editor. `pageWindow` is the page's own window object. */
function editorProbeOf(pageWindow: unknown, document: Document): EditorProbe {
  const element = document.querySelector(EDITOR_ELEMENT_SELECTOR);
  try {
    return { ...probeOf(pageWindow, element), failure: null };
  } catch (error) {
    return {
      ...probeOf(undefined, null),
      failure: error instanceof Error ? error.name : "unknown",
    };
  }
}

/** The page's own window: `unsafeWindow` in a script with grants, else the script's own. */
function pageWindowOf(): unknown {
  return typeof unsafeWindow === "undefined" ? globalThis : unsafeWindow;
}

export type { EditorProbe };
export { editorProbeOf, pageWindowOf };
