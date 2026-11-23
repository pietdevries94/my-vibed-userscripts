// What the viewed files feature folds when the Files tab opens.
import { PULL_REQUEST, isCardOpen, startedPage, toggleOf } from "./viewed-page.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("a folder whose files are all ticked when the page loads starts folded, and only the outermost one", async () => {
  const { tree } = await startedPage({ ticked: ["/web/cart/basket.ts", "/web/cart/coupon.ts"] });
  assert.equal(tree.isFolded("/web/cart"), true);
  assert.equal(tree.isFolded("/web"), false);
  assert.equal(tree.scroller.scrollTop, 0);
  assert.equal(tree.scroller.style.visibility, "");
});

test("a folder whose files are all ticked when the page loads stays open while a single file is open", async () => {
  const { tree } = await startedPage({
    openFile: "/api/orders.ts",
    ticked: ["/api/orders.ts", "/api/totals.ts"],
  });
  assert.equal(tree.isFolded("/api"), false);
});

test("the card of a file ticked when the page loads starts collapsed, the others open", async () => {
  const { tree } = await startedPage({ ticked: ["/web/home.ts"] });
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), false);
  assert.equal(isCardOpen(tree.document, "/api/orders.ts"), true);
});

test("a viewed card the owner opens again stays open", async () => {
  const { tree, viewed } = await startedPage({ ticked: ["/web/home.ts"] });
  toggleOf(tree.document, "/web/home.ts")
    .closest(".repos-summary-header")
    ?.querySelector<HTMLElement>(".bolt-card-expand-button")
    ?.click();
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  viewed.sync(PULL_REQUEST);
  assert.equal(isCardOpen(tree.document, "/web/home.ts"), true);
});

test("folding many viewed folders on load takes one walk through the tree, not one per folder", async () => {
  const areas = Array.from(
    { length: 40 },
    (_area, index) => `/src/area${String(index).padStart(2, "0")}`,
  );
  const ticked = areas.flatMap((area) => [`${area}/done/a.ts`, `${area}/done/b.ts`]);
  const changedPaths = [...ticked, ...areas.map((area) => `${area}/todo.ts`)];
  const { tree } = await startedPage({ changedPaths, rowsInView: 10, ticked });
  assert.equal(tree.isFolded("/src/area00/done"), true);
  assert.equal(tree.isFolded("/src/area39/done"), true);
  assert.equal(tree.isFolded("/src/area39"), false);
  // A walk through the 201 rows steps 8 rows at a time: about 25 writes. One walk scans, one folds.
  assert.ok(tree.scrollWrites() <= 70, `${String(tree.scrollWrites())} scroll writes`);
});
