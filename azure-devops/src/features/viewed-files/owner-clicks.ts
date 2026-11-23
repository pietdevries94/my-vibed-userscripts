// Tells the owner's clicks on the file tree's folders from the script's own.
const TREE_SELECTOR = ".repos-changes-explorer-tree";
const TICK_SELECTOR = ".bolt-checkbox";
/** Keys that open or fold the folder row in focus. */
const FOLD_KEYS = new Set(["ArrowLeft", "ArrowRight", "Enter"]);

const watchedTrees = new WeakSet<Element>();
let isScriptClick = false;

/** Clicks an element for the script, so the watch does not take it for the owner's click. */
function clickForScript(element: HTMLElement | null | undefined): void {
  isScriptClick = true;
  try {
    element?.click();
  } finally {
    isScriptClick = false;
  }
}

/** True when the event can open or fold a folder: a click beside the ticks, or a fold key. */
function isFoldEvent(view: Window & typeof globalThis, event: Event): boolean {
  if (event instanceof view.KeyboardEvent) {
    return FOLD_KEYS.has(event.key);
  }
  return event.target instanceof view.Element && event.target.closest(TICK_SELECTOR) === null;
}

/** Calls `onOwnerFold` when the owner clicks or presses a key that can open or fold a folder in the tree. */
function watchOwnerFolds(document: Document, onOwnerFold: () => void): void {
  const tree = document.querySelector(TREE_SELECTOR);
  const view = document.defaultView;
  if (tree === null || view === null || watchedTrees.has(tree)) {
    return;
  }
  watchedTrees.add(tree);
  const onEvent = (event: Event): void => {
    if (!isScriptClick && isFoldEvent(view, event)) {
      onOwnerFold();
    }
  };
  tree.addEventListener("click", onEvent, { capture: true });
  tree.addEventListener("keydown", onEvent, { capture: true });
}

export { clickForScript, watchOwnerFolds };
