import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { feedLayoutOf } from "./capture-feed-layout.ts";
import { test } from "node:test";

const FEED = `
  <table class="activity-feed-list"><tbody>
    <tr class="bolt-list-row-spacer"><td style="height: 0px"></td></tr>
    <tr class="bolt-timeline-row"><td>Quill Barrow approved</td></tr>
    <tr class="bolt-timeline-row"><td>
      <div class="bolt-timeline-sequence"></div>
      <div class="bolt-timeline-cell-content"><div class="bolt-card" data-fix-ado-push="folded">A push</div></div>
    </td></tr>
    <tr class="bolt-timeline-row" style="height: 240px"><td>
      <div class="bolt-card" data-fix-ado-push="open">Another push</div>
    </td></tr>
  </tbody></table>`;

test("the feed layout names the kind of each row and whether its height is set, and no content", () => {
  const { document } = new JSDOM(FEED).window;
  assert.deepEqual(feedLayoutOf(document), {
    rows: [
      "spacer:0:0:0:0:0:set",
      "row:0:0:0:0:0:auto",
      "push-folded:0:0:0:0:0:auto",
      "push-open:0:0:0:0:0:set",
    ],
  });
});

test("a page without an activity feed has no feed layout", () => {
  assert.equal(feedLayoutOf(new JSDOM("<p>Files</p>").window.document), null);
});
