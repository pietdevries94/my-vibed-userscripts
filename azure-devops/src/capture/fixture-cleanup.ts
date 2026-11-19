// The fixture import's cleanup for this script's page captures. Dev only.
import { JSDOM } from "jsdom";
import { buildFixtureDom } from "../../../shared/dev/fake-site/fixture-dom.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

/**
 * A captured page's HTML without what this script added, for a capture made
 * before the capture took it out itself. The capture is the page's body, or one
 * element of it. It is parsed as the fake site parses it, so a table's link rows
 * stay in their table.
 */
function cleanFixtureHtml(html: string): string {
  const { document } = new JSDOM("<!doctype html>").window;
  const root = buildFixtureDom(document, html.trim());
  return root === null ? html : withoutScriptMarks(root).outerHTML;
}

export { cleanFixtureHtml };
