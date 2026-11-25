import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createCardPeek } from "./card-peek.ts";
import { test } from "node:test";

/** A folded card whose fold button adds its list when it unfolds, and takes it out when it folds. */
function foldedCard(): { document: Document; card: HTMLElement; clicks: () => number } {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const card = document.createElement("div");
  card.className = "repos-pr-section-card";
  card.innerHTML = `<button class="repos-pr-section-expand-button"></button>
    <div class="repos-pr-section-header-title"><span class="text-ellipsis">Assigned to me</span></div>`;
  document.body.append(card);
  let clickCount = 0;
  card.querySelector("button")?.addEventListener("click", () => {
    clickCount += 1;
    const content = card.querySelector(".bolt-card-content");
    if (content) {
      content.remove();
    } else {
      card.append(Object.assign(document.createElement("div"), { className: "bolt-card-content" }));
    }
  });
  return { card, clicks: () => clickCount, document };
}

/** A title store that holds `title`, and keeps what is set in `set`. */
function titleStore(title: string): { get: () => string; set: (title: string) => void } {
  const set: string[] = [];
  return {
    get: () => set.at(-1) ?? title,
    set: (newTitle) => {
      set.push(newTitle);
    },
  };
}

test("unfolds the folded card out of sight, and folds it again once its tabs are built", () => {
  const { card, clicks, document } = foldedCard();
  const peek = createCardPeek(() => 0, titleStore("Assigned to me"));

  peek.sync(document, "none", "pull requests");
  assert.equal(clicks(), 1);
  assert.ok(card.classList.contains("fix-ado-assigned-peeking"));

  peek.sync(document, "stacked", "pull requests");
  assert.equal(clicks(), 2);
  assert.ok(!card.classList.contains("fix-ado-assigned-peeking"));
  assert.equal(card.querySelector(".bolt-card-content"), null);

  peek.sync(document, "folded", "pull requests");
  assert.equal(clicks(), 2, "built for these pull requests, so it stays folded");

  peek.sync(document, "folded", "other pull requests");
  assert.equal(clicks(), 3, "other pull requests, so it unfolds again");
});

test("leaves a card with another title alone", () => {
  const { clicks, document } = foldedCard();
  const peek = createCardPeek(() => 0, titleStore("Created by me"));

  peek.sync(document, "none", "pull requests");

  assert.equal(clicks(), 0);
});

test("folds the card again when it does not unfold in time, and does not try again", () => {
  const { clicks, document } = foldedCard();
  let time = 0;
  const peek = createCardPeek(() => time, titleStore("Assigned to me"));
  peek.sync(document, "none", "pull requests");

  time = 6000;
  peek.sync(document, "none", "pull requests");
  assert.equal(clicks(), 2);

  peek.sync(document, "none", "pull requests");
  assert.equal(clicks(), 2);
});
