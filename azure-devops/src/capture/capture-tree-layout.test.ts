import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";
import { treeLayoutOf } from "./capture-tree-layout.ts";

const TREE = `
  <div class="v-scroll-auto"><table class="repos-changes-explorer-tree"><tbody>
    <tr class="fix-ado-review-tree-spacer"></tr>
    <tr class="bolt-list-row-spacer"><td></td></tr>
    <tr class="bolt-tree-row" aria-rowindex="7"><td>Totals</td></tr>
    <tr class="bolt-tree-row" aria-rowindex="8">
      <td><div class="repos-file-explorer-tree-thread-item">A thread</div></td>
    </tr>
    <tr class="bolt-tree-row fix-ado-review-tree-row"><td>A pending comment</td></tr>
  </tbody></table></div>`;

test("the tree layout names the kind and the row number of each row, and no content", () => {
  const { document } = new JSDOM(TREE).window;
  assert.deepEqual(treeLayoutOf(document), {
    rows: ["own-spacer::0:0", "tree-spacer::0:0", "row:7:0:0", "thread:8:0:0", "pending::0:0"],
    view: "0:0",
  });
});

test("a page without a file tree has no tree layout", () => {
  assert.equal(treeLayoutOf(new JSDOM("<p>Overview</p>").window.document), null);
});
