/** The cancel function of a wait that has nothing to cancel. */
function stopNothing(): void {
  // Nothing is waiting.
}

/**
 * Runs `callback` once, on the next change to the document: a node added or removed, an
 * attribute or a text changed. Returns a function that cancels it.
 */
function onNextDomChange(document: Document, callback: () => void): () => void {
  const view = document.defaultView;
  if (view === null) {
    return stopNothing;
  }
  const observer = new view.MutationObserver(() => {
    observer.disconnect();
    callback();
  });
  observer.observe(document, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  return () => {
    observer.disconnect();
  };
}

export { onNextDomChange, stopNothing };
