// Turns a design canvas artboard (a .dc.html file) into a plain page a browser opens on its own,
// for the pixel diff. The canvas wraps the page in its own elements and scripts; the page's
// markup and styles stay as they are. Dev file only.

const CANVAS_PARTS = [
  /<script src="\.\/support\.js"><\/script>/gu,
  /<script type="text\/x-dc"[^>]*>[\s\S]*?<\/script>/gu,
  /<\/?(?:x-dc|helmet)>/gu,
];

/** The artboard's page without the canvas's wrappers and scripts. */
function artboardHtml(source: string): string {
  let html = source;
  for (const part of CANVAS_PARTS) {
    html = html.replaceAll(part, "");
  }
  return html;
}

export { artboardHtml };
