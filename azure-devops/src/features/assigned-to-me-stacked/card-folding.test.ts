import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { showCardFolding } from "./card-folding.ts";
import { test } from "node:test";

function builtCard(): HTMLElement {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const card = document.createElement("div");
  card.innerHTML = `<button class="repos-pr-section-expand-button" aria-label="Fold">
    <span class="fluent-icons-enabled"><span class="fabric-icon ms-Icon--ChevronDownMed"></span></span>
  </button><div class="bolt-card-content"></div>`;
  document.body.append(card);
  return card;
}

test("a card's fold button folds that card only, and it stays folded when shown again", () => {
  const folded = new Set<string>();
  const card = builtCard();
  const folding = {
    foldedTabIds: folded,
    onToggle(tabId: string): void {
      if (!folded.delete(tabId)) {
        folded.add(tabId);
      }
      showCardFolding(card, "waiting", folding);
    },
  };
  showCardFolding(card, "waiting", folding);
  const button = card.querySelector("button");
  assert.equal(button?.getAttribute("aria-expanded"), "true");

  button?.click();
  assert.ok(card.classList.contains("fix-ado-assigned-folded"));
  assert.equal(button?.getAttribute("aria-expanded"), "false");
  assert.ok(button?.querySelector(".ms-Icon--ChevronRightMed"));

  showCardFolding(card, "waiting", folding);
  button?.click();
  assert.ok(!card.classList.contains("fix-ado-assigned-folded"));
  assert.deepEqual([...folded], []);
});
