// A Files tab with the viewed files feature started on a small pull request. Test code only.
import type { ViewedFiles, ViewedFilesOptions } from "./viewed-files.ts";
import type { VirtualTree } from "./virtual-tree.test-page.ts";
import assert from "node:assert/strict";
import { createViewedFiles } from "./viewed-files.ts";
import { createVirtualTree } from "./virtual-tree.test-page.ts";

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
  scrollStopsShortPx?: number;
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

export {
  CHANGED_PATHS,
  PULL_REQUEST,
  TIMEOUT_MS,
  clickToggle,
  clientFor,
  isCardOpen,
  startedPage,
  toggleOf,
};
