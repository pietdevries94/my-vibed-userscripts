import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import { setCardOpen, syncViewedToggles } from "./viewed-toggles.ts";
import type { FileHeader } from "./viewed-toggles.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

function toggled(document: Document, viewed: Set<string>): FileHeader[] {
  const clicks: FileHeader[] = [];
  syncViewedToggles(document, {
    isViewed: (path) => viewed.has(path),
    onToggle: (header) => {
      clicks.push(header);
    },
  });
  return clicks;
}

test(
  "each captured file card gets a Viewed toggle before its View link, for the path under its name",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-tree-empty-area");
    const cards = [...document.querySelectorAll(".repos-summary-header")];
    assert.ok(cards.length > 0);
    const clicks = toggled(document, new Set());
    for (const fileCard of cards) {
      const toggle = fileCard.querySelector<HTMLElement>(".fix-ado-viewed-toggle");
      assert.equal(toggle?.nextElementSibling?.classList.contains("bolt-link-button"), true);
      const shownPath = fileCard
        .querySelector(".bolt-card-expand-button")
        ?.getAttribute("aria-label");
      assert.equal(toggle?.dataset.fixAdoViewedPath, `/${shownPath ?? ""}`);
    }
    firstCard(cards).querySelector<HTMLInputElement>(".fix-ado-viewed-toggle input")?.click();
    assert.equal(clicks.length, 1);
    assert.equal(clicks[0]?.card, cards[0]);
  },
);

test(
  "a second sync adds no second toggle, and shows a file as viewed",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-tree-empty-area");
    toggled(document, new Set());
    const first = firstCard([...document.querySelectorAll(".repos-summary-header")]);
    const path =
      first.querySelector<HTMLElement>(".fix-ado-viewed-toggle")?.dataset.fixAdoViewedPath ?? "";
    toggled(document, new Set([path]));
    assert.equal(first.querySelectorAll(".fix-ado-viewed-toggle").length, 1);
    assert.equal(
      first.querySelector<HTMLInputElement>(".fix-ado-viewed-toggle input")?.checked,
      true,
    );
  },
);

test(
  "the bar above a captured single file gets the toggle before the Inline button",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files");
    toggled(document, new Set());
    const toggles = document.querySelectorAll(".repos-compare-toolbar .fix-ado-viewed-toggle");
    assert.equal(toggles.length, 1);
    assert.equal(toggles[0]?.nextElementSibling?.classList.contains("bolt-split-button"), true);
  },
);

test(
  "the bar above a captured file without the Inline button gets the toggle before its command bar",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-scrolled-tree");
    toggled(document, new Set());
    const toggles = document.querySelectorAll(".repos-compare-toolbar .fix-ado-viewed-toggle");
    assert.equal(toggles.length, 1);
    assert.equal(
      toggles[0]?.nextElementSibling?.classList.contains("repos-compare-header-commandbar"),
      true,
    );
  },
);

test("the bar above a captured open folder gets no toggle", { skip: fixtures.skip }, () => {
  const { document } = loadCapturedPullRequest("pr-files-tree-empty-area");
  toggled(document, new Set());
  assert.equal(
    document.querySelectorAll(".repos-compare-toolbar .fix-ado-viewed-toggle").length,
    0,
  );
});

test(
  "a captured file card collapses and opens through its own chevron",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-tree-empty-area");
    const first = firstCard([...document.querySelectorAll(".repos-summary-header")]);
    const expand = first.querySelector(".bolt-card-expand-button");
    let clicks = 0;
    expand?.addEventListener("click", () => {
      clicks += 1;
    });
    setCardOpen(first, true);
    assert.equal(clicks, 0, "an open card stays as it is");
    setCardOpen(first, false);
    assert.equal(clicks, 1);
  },
);

function firstCard(cards: Element[]): Element {
  const [first] = cards;
  assert.ok(first !== undefined);
  return first;
}
