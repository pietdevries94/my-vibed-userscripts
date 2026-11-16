// A comment box in the single-file view. There Azure DevOps shows the file in a code
// editor, which draws only the lines in view and places them by pixel. The box sits in
// a zone under its line; the file's path is in the bar above the editor.
import type { LineAnchor } from "./review-store.ts";

const ZONE_SELECTOR = ".zone-widget";
const EDITOR_SELECTOR = ".monaco-editor";
/** The editor of the file before the change, in a diff. */
const OLD_FILE_EDITOR_CLASS = "original-in-monaco-diff-editor";
const GUTTER_SELECTOR = ".margin";
const GUTTER_ROW_SELECTOR = ".margin-view-overlays > div";
const LINE_NUMBER_SELECTOR = ".line-numbers";
const LINE_SELECTOR = ".lines-content > .view-lines > .view-line";
/** The full path under the file name, in the bar above the single-file view's editor. */
const SHOWN_PATH_SELECTOR = ".repos-compare-toolbar .secondary-text.text-ellipsis";
/** Positions this close count as equal. */
const PIXEL_TOLERANCE = 1;

/** A length the editor wrote in an element's style, such as "450px". NaN without one. */
function pixels(element: HTMLElement | null, property: "height" | "top"): number {
  const length = element?.style[property] ?? "";
  return length.endsWith("px") ? Number(length.slice(0, -"px".length)) : Number.NaN;
}

/**
 * The path of the file the single-file view shows, or null in another view. It is read
 * under the file's name above the editor, where it is written as in the all-files
 * view. The page's address is the fallback.
 */
function shownFilePath(document: Document): string | null {
  const shown = document.querySelector(SHOWN_PATH_SELECTOR)?.textContent.trim() ?? "";
  const path = shown === "" ? new URLSearchParams(document.location.search).get("path") : shown;
  return path === null || path === "" ? null : path;
}

/** The gutter row that ends where the zone starts: the row of the line the box is on. */
function gutterRowAbove(editor: Element, zone: HTMLElement): HTMLElement | null {
  const gutterTop = pixels(editor.querySelector<HTMLElement>(GUTTER_SELECTOR), "top");
  const zoneTop = pixels(zone, "top");
  return (
    [...editor.querySelectorAll<HTMLElement>(GUTTER_ROW_SELECTOR)].find(
      (row) =>
        Math.abs(gutterTop + pixels(row, "top") + pixels(row, "height") - zoneTop) <
        PIXEL_TOLERANCE,
    ) ?? null
  );
}

/** The length of the line the editor draws at this height. Zero when it draws none. */
function lineLengthAt(editor: Element, top: number): number {
  const line = [...editor.querySelectorAll<HTMLElement>(LINE_SELECTOR)].find(
    (candidate) => pixels(candidate, "top") === top,
  );
  return line?.textContent.length ?? 0;
}

/** Where each zone's box was last read to sit. */
const anchorByZone = new WeakMap<Element, Omit<LineAnchor, "iteration">>();

/** Where a box sits, read from the line the editor draws above its zone. Null when it draws no such line. */
function drawnAnchorOf(zone: HTMLElement, filePath: string): Omit<LineAnchor, "iteration"> | null {
  const editor = zone.closest(EDITOR_SELECTOR);
  const row = editor === null ? null : gutterRowAbove(editor, zone);
  const line = Number(row?.querySelector(LINE_NUMBER_SELECTOR)?.textContent);
  if (editor === null || row === null || !(line > 0)) {
    return null;
  }
  return {
    filePath,
    line,
    lineLength: lineLengthAt(editor, pixels(row, "top")),
    side: editor.classList.contains(OLD_FILE_EDITOR_CLASS) ? "left" : "right",
  };
}

/**
 * Where a box in the code editor sits, or null when the page does not say. The editor
 * stops drawing the box's line once it scrolls out of view, as it does at the end of
 * a tall box; the box then sits where it was last read to sit.
 */
function editorAnchorOf(box: Element): Omit<LineAnchor, "iteration"> | null {
  const zone = box.closest<HTMLElement>(ZONE_SELECTOR);
  const filePath = shownFilePath(box.ownerDocument);
  if (zone === null || filePath === null) {
    return null;
  }
  const drawn = drawnAnchorOf(zone, filePath);
  if (drawn !== null) {
    anchorByZone.set(zone, drawn);
    return drawn;
  }
  const last = anchorByZone.get(zone);
  return last?.filePath === filePath ? last : null;
}

export { ZONE_SELECTOR, editorAnchorOf, pixels, shownFilePath };
