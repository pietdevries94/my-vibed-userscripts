import type { ViewedFiles, ViewedFilesOptions } from "./viewed-files.ts";
import type { VirtualTree } from "./virtual-tree.test-page.ts";
import assert from "node:assert/strict";
import { createViewedFiles } from "./viewed-files.ts";
import { createVirtualTree } from "./virtual-tree.test-page.ts";
import { test } from "node:test";

const PULL_REQUEST = { project: "shop", pullRequestId: 7, repository: "web" };

const CHANGED_PATHS = [
  "/api/orders.ts",
  "/api/totals.ts",
  "/docs/readme.md",
  "/web/cart/basket.ts",
  "/web/cart/coupon.ts",
  "/web/home.ts",
];

function clientFor(changedPaths: string[]): ViewedFilesOptions["client"] {
  return {
    getIterationChanges: async () =>
      changedPaths.map((path, index) => ({ changeTrackingId: index + 1, item: { path } })),
    getPullRequestIterationIds: async () => [1, 2],
  };
}

/** A page with a tree that draws three rows, the viewed files feature started and done with its first scan. */
async function startedPage(
  ticked: string[] = [],
): Promise<{ tree: VirtualTree; viewed: ViewedFiles }> {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3, ticked });
  const viewed = createViewedFiles({
    client: clientFor(CHANGED_PATHS),
    document: tree.document,
    drawTimeoutMs: 20,
  });
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  return { tree, viewed };
}

function toggleOf(document: Document, path: string): HTMLInputElement {
  const card = [...document.querySelectorAll(".repos-summary-header")].find(
    (header) => header.querySelector(".secondary-text")?.textContent === path,
  );
  const toggle = card?.querySelector<HTMLInputElement>(".fix-ado-viewed-toggle input");
  assert.ok(toggle, `the card of ${path} has a Viewed toggle`);
  return toggle;
}

function isCardOpen(document: Document, path: string): boolean {
  const card = toggleOf(document, path).closest(".repos-summary-header");
  return card?.querySelector(".bolt-card-expand-button")?.getAttribute("aria-expanded") === "true";
}

async function clickToggle(document: Document, path: string, viewed: ViewedFiles): Promise<void> {
  const toggle = toggleOf(document, path);
  toggle.click();
  await viewed.idle();
}

test("every file card gets a Viewed toggle", async () => {
  const { tree } = await startedPage();
  for (const path of CHANGED_PATHS) {
    assert.equal(toggleOf(tree.document, path).checked, false);
  }
  assert.equal(toggleOf(tree.document, "/web/home.ts").labels?.[0]?.textContent, "Viewed");
});

test("a card shows the tick of a file the tree does not draw, and the tree stays scrolled where it was", async () => {
  const { tree } = await startedPage(["/web/home.ts"]);
  assert.equal(toggleOf(tree.document, "/web/home.ts").checked, true);
  assert.equal(toggleOf(tree.document, "/api/orders.ts").checked, false);
  assert.equal(tree.scroller.scrollTop, 0);
  assert.equal(tree.scroller.style.visibility, "");
});

test("Viewed on a card ticks its file in the tree, also when the tree does not draw it, and collapses the card", async () => {
  const { tree, viewed } = await startedPage();
  await clickToggle(tree.document, "/web/home.ts", viewed);
  assert.equal(tree.isTicked("/web/home.ts"), true);
  assert.equal(toggleOf(tree.document, "/web/home.ts").checked, true);
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), false);
  assert.equal(tree.scroller.scrollTop, 0);
});

test("clearing Viewed unticks the file and opens the card again", async () => {
  const { tree, viewed } = await startedPage(["/docs/readme.md"]);
  await clickToggle(tree.document, "/docs/readme.md", viewed);
  assert.equal(tree.isTicked("/docs/readme.md"), false);
  assert.equal(toggleOf(tree.document, "/docs/readme.md").checked, false);
  assert.equal(isCardOpen(tree.document, "/docs/readme.md"), true);
});

test("ticking the last file of a folder collapses the folder", async () => {
  const { tree, viewed } = await startedPage(["/api/orders.ts"]);
  assert.equal(tree.isFolded("/api"), false);
  await clickToggle(tree.document, "/api/totals.ts", viewed);
  assert.equal(tree.isFolded("/api"), true);
});

test("a folder whose files are all ticked when the page loads stays open", async () => {
  const { tree } = await startedPage(["/api/orders.ts", "/api/totals.ts"]);
  assert.equal(tree.isFolded("/api"), false);
});

test("ticking a file in the tree collapses its folder once all its files are ticked", async () => {
  const { tree, viewed } = await startedPage(["/api/orders.ts"]);
  tree.clickTick("/api/totals.ts");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  await tree.settled();
  assert.equal(tree.isFolded("/api"), true);
  assert.equal(toggleOf(tree.document, "/api/totals.ts").checked, true);
});

test("clearing Viewed of a file in a collapsed folder opens the folder and unticks the file", async () => {
  const { tree, viewed } = await startedPage(["/web/cart/coupon.ts"]);
  await clickToggle(tree.document, "/web/cart/basket.ts", viewed);
  assert.equal(tree.isFolded("/web/cart"), true);
  await clickToggle(tree.document, "/web/cart/basket.ts", viewed);
  assert.equal(tree.isTicked("/web/cart/basket.ts"), false);
  assert.equal(tree.isFolded("/web/cart"), false);
});

test("ticking a folder in the tree marks its files Viewed, also ones the tree does not draw", async () => {
  const { tree, viewed } = await startedPage();
  tree.clickTick("/api");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  assert.equal(toggleOf(tree.document, "/api/orders.ts").checked, true);
  assert.equal(toggleOf(tree.document, "/api/totals.ts").checked, true);
});
