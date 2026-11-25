// Marks <html> while the pull request lists show each pull request on one line. style.css
// lays the site's rows out from that mark, so the site's own rows stay in place.

const ONE_LINE_ATTRIBUTE = "data-fix-ado-one-line";

/** Turns the one-line rows on or off. Writes only on a change, so the page's observers stay quiet. */
function showOneLineRows(document: Document, isOneLine: boolean): void {
  const root = document.documentElement;
  if (root.hasAttribute(ONE_LINE_ATTRIBUTE) !== isOneLine) {
    root.toggleAttribute(ONE_LINE_ATTRIBUTE, isOneLine);
  }
}

export { showOneLineRows };
