import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";
import { withoutScriptMarks } from "./capture-script-marks.ts";

function bodyOf(html: string, bodyClass = ""): Element {
  return new JSDOM(`<!doctype html><body class="${bodyClass}">${html}</body>`).window.document.body;
}

test("every element the script added goes, with what it holds", () => {
  const body = bodyOf(
    `<div class="bolt-button-group">
      <div class="fix-ado-first-unread-box margin-bottom-16"><button class="fix-ado-first-unread bolt-button">Go to first unread</button></div>
      <button class="bolt-button">Filter</button>
    </div>
    <span class="bolt-pill fix-ado-new-chip">New</span>`,
  );
  const copy = withoutScriptMarks(body);
  assert.equal(copy.querySelector("[class*='fix-ado-']"), null);
  assert.equal(copy.querySelector(".bolt-button")?.textContent, "Filter");
});

test("the table's header and cells, the group rows and the stacked cards go too", () => {
  const body = bodyOf(
    `<div class="repos-pr-section-card fix-ado-assigned-card"><table></table></div>
    <table class="repos-pr-list"><thead class="fix-ado-table-head"><tr><th>Id</th></tr></thead><tbody>
      <tr class="fix-ado-work-item-group"><td>#12</td></tr>
      <tr><td>Fix the thing<span class="fix-ado-linked-work-item">#12</span></td>
        <td class="fix-ado-table-id">!4021</td><td class="fix-ado-table-target">main</td></tr>
    </tbody></table>
    <label class="fix-ado-table-switch">Table</label>`,
  );
  const copy = withoutScriptMarks(body);
  assert.equal(copy.querySelector("[class*='fix-ado-']"), null);
  assert.equal(copy.querySelectorAll("table").length, 1);
  assert.equal(copy.querySelector("td")?.textContent, "Fix the thing");
});

test("the page's own elements stay, without the script's attributes and style properties", () => {
  const body = bodyOf(
    `<div class="bolt-coin" data-fix-ado-initials="QB" style="--fix-ado-hue: 12"><img alt=""></div>`,
  );
  const coin = withoutScriptMarks(body).querySelector<HTMLElement>(".bolt-coin");
  assert.ok(coin);
  assert.equal(coin.dataset.fixAdoInitials, undefined);
  assert.equal(coin.getAttribute("style"), null);
});

test("a page's own panel with a fix-ado- class stays, without the class", () => {
  const body = bodyOf(
    `<div class="bolt-panel fix-ado-dimmed" data-fix-ado-open=""><p>Panel text</p></div>`,
  );
  const panel = withoutScriptMarks(body).querySelector<HTMLElement>(".bolt-panel");
  assert.ok(panel);
  assert.equal(panel.className, "bolt-panel");
  assert.equal(panel.dataset.fixAdoOpen, undefined);
  assert.equal(panel.textContent, "Panel text");
});

test("the body loses the script's classes, not itself", () => {
  const body = bodyOf(`<p>Text</p>`, "lwp fix-ado-starred-picking");
  const copy = withoutScriptMarks(body);
  assert.equal(copy.className, "lwp");
  assert.equal(copy.querySelector("p")?.textContent, "Text");
});

test("the page is not changed, only its copy", () => {
  const body = bodyOf(`<span class="fix-ado-star"></span>`);
  withoutScriptMarks(body);
  assert.ok(body.querySelector(".fix-ado-star"));
});
