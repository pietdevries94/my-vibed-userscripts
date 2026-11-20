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

interface PageOptions {
  ticked?: string[];
  openFile?: string;
  tickDelayMs?: number;
  drawDelayMs?: number;
  pageRows?: number;
}

/** The safety cap on each wait. A step that hits it makes a test slow, never green. */
const TIMEOUT_MS = 2000;

/** A page with a tree that draws three rows, the viewed files feature started and done with its first scan. */
async function startedPage(
  options: PageOptions = {},
): Promise<{ tree: VirtualTree; viewed: ViewedFiles }> {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3, ...options });
  const viewed = createViewedFiles({
    client: clientFor(CHANGED_PATHS),
    document: tree.document,
    drawTimeoutMs: TIMEOUT_MS,
    tickTimeoutMs: TIMEOUT_MS,
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
  const { tree } = await startedPage({ ticked: ["/web/home.ts"] });
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
  const { tree, viewed } = await startedPage({ ticked: ["/docs/readme.md"] });
  await clickToggle(tree.document, "/docs/readme.md", viewed);
  assert.equal(tree.isTicked("/docs/readme.md"), false);
  assert.equal(toggleOf(tree.document, "/docs/readme.md").checked, false);
  assert.equal(isCardOpen(tree.document, "/docs/readme.md"), true);
});

test("ticking the last file of a folder collapses the folder", async () => {
  const { tree, viewed } = await startedPage({ ticked: ["/api/orders.ts"] });
  assert.equal(tree.isFolded("/api"), false);
  await clickToggle(tree.document, "/api/totals.ts", viewed);
  assert.equal(tree.isFolded("/api"), true);
});

test("a folder whose files are all ticked when the page loads stays open", async () => {
  const { tree } = await startedPage({ ticked: ["/api/orders.ts", "/api/totals.ts"] });
  assert.equal(tree.isFolded("/api"), false);
});

test("ticking a file in the tree collapses its folder once all its files are ticked", async () => {
  const { tree, viewed } = await startedPage({ ticked: ["/api/orders.ts"] });
  tree.clickTick("/api/totals.ts");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  await tree.settled();
  assert.equal(tree.isFolded("/api"), true);
  assert.equal(toggleOf(tree.document, "/api/totals.ts").checked, true);
});

test("clearing Viewed of a file in a collapsed folder opens the folder and unticks the file", async () => {
  const { tree, viewed } = await startedPage({ ticked: ["/web/cart/coupon.ts"] });
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

function barToggle(document: Document): HTMLInputElement {
  const toggle = document.querySelector<HTMLInputElement>(
    ".repos-compare-toolbar .fix-ado-viewed-toggle input",
  );
  assert.ok(toggle, "the bar above the open file has a Viewed toggle");
  return toggle;
}

test("Viewed in the bar above a single file ticks the folder's last file, and the folder stays open", async () => {
  const { tree, viewed } = await startedPage({
    openFile: "/api/totals.ts",
    ticked: ["/api/orders.ts"],
  });
  barToggle(tree.document).click();
  await viewed.idle();
  assert.equal(tree.isTicked("/api/totals.ts"), true);
  assert.equal(barToggle(tree.document).checked, true);
  assert.equal(tree.isFolded("/api"), false);
});

test("ticking a folder's last file in the tree while a single file is open leaves the folder open", async () => {
  const { tree, viewed } = await startedPage({
    openFile: "/api/totals.ts",
    ticked: ["/api/orders.ts"],
  });
  tree.clickTick("/api/totals.ts");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  await tree.settled();
  assert.equal(tree.isFolded("/api"), false);
  assert.equal(barToggle(tree.document).checked, true);
});

test("Viewed in the bar ticks the file the bar shows now, also when the bar changed its text in place since the last sync", async () => {
  const { tree, viewed } = await startedPage({ openFile: "/api/orders.ts" });
  tree.showFileInBar("/web/home.ts");
  barToggle(tree.document).click();
  await viewed.idle();
  assert.equal(tree.isTicked("/web/home.ts"), true);
  assert.equal(tree.isTicked("/api/orders.ts"), false);
});

test("after the bar changed its text in place, Viewed flips the shown file, not what the stale checkbox showed", async () => {
  const { tree, viewed } = await startedPage({
    openFile: "/api/orders.ts",
    ticked: ["/api/orders.ts"],
  });
  tree.showFileInBar("/web/home.ts");
  barToggle(tree.document).click();
  await viewed.idle();
  assert.equal(tree.isTicked("/web/home.ts"), true);
  assert.equal(tree.isTicked("/api/orders.ts"), true);
  assert.equal(barToggle(tree.document).checked, true);
});

test("Viewed collapses the card right on the click, before the tree shows the tick", async () => {
  const { tree, viewed } = await startedPage();
  toggleOf(tree.document, "/web/home.ts").click();
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), false);
  await viewed.idle();
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), false);
});

test("a card opens again when the tree does not take the tick", async () => {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3 });
  // The script does not know the file, so it finds no row to tick.
  const known = CHANGED_PATHS.filter((path) => path !== "/web/home.ts");
  const viewed = createViewedFiles({
    client: clientFor(known),
    document: tree.document,
    drawTimeoutMs: TIMEOUT_MS,
    tickTimeoutMs: TIMEOUT_MS,
  });
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  toggleOf(tree.document, "/web/home.ts").click();
  await viewed.idle();
  assert.equal(tree.isTicked("/web/home.ts"), false);
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), true);
  assert.equal(toggleOf(tree.document, "/web/home.ts").checked, false);
});

test("a tick the tree shows only after a slow save still collapses the card and the folder", async () => {
  const { tree, viewed } = await startedPage({ tickDelayMs: 100, ticked: ["/api/orders.ts"] });
  await clickToggle(tree.document, "/api/totals.ts", viewed);
  assert.equal(tree.isTicked("/api/totals.ts"), true);
  assert.equal(isCardOpen(tree.document, "/api/totals.ts"), false);
  assert.equal(toggleOf(tree.document, "/api/totals.ts").checked, true);
  assert.equal(tree.isFolded("/api"), true);
});

test("each step waits on the tree's redraw, not a timer: a slow tree that draws in pages still ticks a far file and folds its folder quickly", async () => {
  const started = Date.now();
  const { tree, viewed } = await startedPage({
    drawDelayMs: 15,
    pageRows: 8,
    ticked: ["/web/cart/coupon.ts"],
  });
  await clickToggle(tree.document, "/web/cart/basket.ts", viewed);
  assert.equal(tree.isTicked("/web/cart/basket.ts"), true);
  assert.equal(tree.isFolded("/web/cart"), true);
  await clickToggle(tree.document, "/web/cart/basket.ts", viewed);
  assert.equal(tree.isTicked("/web/cart/basket.ts"), false);
  assert.equal(tree.isFolded("/web/cart"), false);
  assert.equal(tree.scroller.scrollTop, 0);
  assert.ok(Date.now() - started < TIMEOUT_MS, "no step waited out its safety cap");
});
