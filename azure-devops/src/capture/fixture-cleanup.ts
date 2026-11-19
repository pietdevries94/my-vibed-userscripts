// The fixture import's cleanup for this script's page captures. Dev only.
import { JSDOM } from "jsdom";
import { withoutScriptMarks } from "./capture-script-marks.ts";

/**
 * A captured page's HTML without what this script added, for a capture made
 * before the capture took it out itself. The capture is the page's body, or one
 * element of it.
 */
function cleanFixtureHtml(html: string): string {
  const { body } = new JSDOM(`<!doctype html>${html}`).window.document;
  const root = html.trimStart().startsWith("<body") ? body : body.firstElementChild;
  return root === null ? html : withoutScriptMarks(root).outerHTML;
}

export { cleanFixtureHtml };
