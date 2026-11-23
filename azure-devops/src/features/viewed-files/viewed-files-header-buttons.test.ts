// The Expand all and Collapse viewed buttons in the pull request's header.
import { PULL_REQUEST, isCardOpen, startedPage } from "./viewed-page.test-page.ts";
import type { ViewedFiles } from "./viewed-files.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const VIEWED = ["/docs/readme.md", "/web/cart/basket.ts", "/web/cart/coupon.ts"];

function headerButton(document: Document, label: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>(".repos-pr-header button")].find(
      (button) => button.textContent === label,
    ) ?? null
  );
}

async function clickHeaderButton(
  document: Document,
  label: string,
  viewed: ViewedFiles,
): Promise<void> {
  const button = headerButton(document, label);
  assert.ok(button, `the header has ${label}`);
  button.click();
  await viewed.idle();
  viewed.sync(PULL_REQUEST);
}

test("the Files tab has Expand all and Collapse viewed before the vote button, and they leave with the tree", async () => {
  const { tree, viewed } = await startedPage();
  const expandAll = headerButton(tree.document, "Expand all");
  const collapseViewed = headerButton(tree.document, "Collapse viewed");
  assert.equal(expandAll?.type, "button");
  assert.equal(collapseViewed?.type, "button");
  const vote = tree.document.querySelector(".repos-pr-header-vote-button");
  assert.equal(expandAll?.parentElement?.nextElementSibling, vote);
  tree.document.querySelector(".repos-changes-explorer-tree")?.remove();
  viewed.sync(PULL_REQUEST);
  assert.equal(headerButton(tree.document, "Expand all"), null);
  assert.equal(headerButton(tree.document, "Collapse viewed"), null);
});

test("Expand all opens every card and every folded folder", async () => {
  const { tree, viewed } = await startedPage({ ticked: VIEWED });
  assert.equal(tree.isFolded("/web/cart"), true);
  await clickHeaderButton(tree.document, "Expand all", viewed);
  for (const path of VIEWED) {
    assert.equal(isCardOpen(tree.document, path), true);
  }
  assert.equal(tree.isFolded("/web/cart"), false);
  assert.equal(tree.isFolded("/docs"), false);
  assert.equal(tree.scroller.style.visibility, "");
});

test("Collapse viewed collapses the viewed cards and folds the outermost folders whose files are all viewed", async () => {
  const { tree, viewed } = await startedPage({ ticked: VIEWED });
  await clickHeaderButton(tree.document, "Expand all", viewed);
  await clickHeaderButton(tree.document, "Collapse viewed", viewed);
  for (const path of VIEWED) {
    assert.equal(isCardOpen(tree.document, path), false);
  }
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), true);
  assert.equal(tree.isFolded("/web/cart"), true);
  assert.equal(tree.isFolded("/docs"), true);
  assert.equal(tree.isFolded("/web"), false);
});

function removeCard(document: Document, path: string): void {
  [...document.querySelectorAll(".repos-summary-header")]
    .find((header) => header.querySelector(".secondary-text")?.textContent === path)
    ?.remove();
}

test("a card Azure DevOps loads after a click gets the click's state", async () => {
  const { tree, viewed } = await startedPage({ ticked: VIEWED });
  removeCard(tree.document, "/docs/readme.md");
  await clickHeaderButton(tree.document, "Expand all", viewed);
  tree.redrawCard("/docs/readme.md", false);
  viewed.sync(PULL_REQUEST);
  assert.equal(isCardOpen(tree.document, "/docs/readme.md"), true);
  removeCard(tree.document, "/docs/readme.md");
  await clickHeaderButton(tree.document, "Collapse viewed", viewed);
  tree.redrawCard("/docs/readme.md", true);
  viewed.sync(PULL_REQUEST);
  assert.equal(isCardOpen(tree.document, "/docs/readme.md"), false);
});

test("Collapse viewed folds a complete folder also while a single file is open", async () => {
  const { tree, viewed } = await startedPage({ openFile: "/web/home.ts", ticked: VIEWED });
  assert.equal(tree.isFolded("/web/cart"), false);
  await clickHeaderButton(tree.document, "Collapse viewed", viewed);
  assert.equal(tree.isFolded("/web/cart"), true);
});
