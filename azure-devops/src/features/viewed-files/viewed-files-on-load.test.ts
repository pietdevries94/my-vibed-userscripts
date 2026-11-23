// What the viewed files feature folds when the Files tab opens.
import {
  CHANGED_PATHS,
  PULL_REQUEST,
  TIMEOUT_MS,
  clientFor,
  isCardOpen,
  startedPage,
  toggleOf,
} from "./viewed-page.test-page.ts";
import { LOADING_CLASS } from "./tree-walk.ts";
import assert from "node:assert/strict";
import { createViewedFiles } from "./viewed-files.ts";
import { createVirtualTree } from "./virtual-tree.test-page.ts";
import { logEntries } from "../../../../shared/runtime/script-log.ts";
import { test } from "node:test";

test("a folder whose files are all ticked when the page loads starts folded, and only the outermost one", async () => {
  const { tree } = await startedPage({ ticked: ["/web/cart/basket.ts", "/web/cart/coupon.ts"] });
  assert.equal(tree.isFolded("/web/cart"), true);
  assert.equal(tree.isFolded("/web"), false);
  assert.equal(tree.scroller.scrollTop, 0);
  assert.equal(tree.scroller.classList.contains(LOADING_CLASS), false);
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

/** A pull request of 166 files whose folders and files share names, as in a real repository. Seeded, so the same each run. */
function sharedNamesPullRequest(seed: number): { changedPaths: string[]; ticked: string[] } {
  let state = seed;
  const next = (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const pick = (names: string[]): string => names[Math.floor(next() * names.length)] ?? "";
  const folders = ["src", "lib", "components", "hooks", "routes", "utils", "app", "services"];
  const files = ["index.ts", "utils.ts", "types.ts", "main.py", "service.py", "readme.md"];
  const paths = new Set<string>();
  while (paths.size < 166) {
    const depth = 1 + Math.floor(next() * 5);
    paths.add(`/${[...Array.from({ length: depth }, () => pick(folders)), pick(files)].join("/")}`);
  }
  const changedPaths = [...paths];
  const viewedFolders = changedPaths
    .map((path) => path.slice(0, path.lastIndexOf("/")))
    .filter(() => next() < 0.15);
  const ticked = changedPaths.filter(
    (path) => next() < 0.2 || viewedFolders.some((folder) => path.startsWith(`${folder}/`)),
  );
  return { changedPaths, ticked };
}

const capsSoFar = (): number =>
  logEntries().filter(({ message }) => message.includes("hit its cap")).length;

test("folders that share names with others fold on load and on Collapse viewed, without a wait running out", async () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const capsBefore = capsSoFar();
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page at a time: they share the script log
    const { tree, viewed } = await startedPage({
      ...sharedNamesPullRequest(seed),
      pageRows: 10,
      rowsInView: 28,
    });
    [...tree.document.querySelectorAll("button")]
      .find((button) => button.textContent === "Collapse viewed")
      ?.click();
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page at a time: they share the script log
    await viewed.idle();
    const missed = logEntries()
      .filter(({ message }) => message.includes("opened or folded folders"))
      .slice(-2)
      .map(({ data }) => JSON.stringify(data));
    assert.equal(capsSoFar() - capsBefore, 0, `seed ${String(seed)}: no wait ran out its cap`);
    for (const pass of missed) {
      assert.match(pass, /"missed":0/u, `seed ${String(seed)}: every folder was found`);
    }
  }
});

test("the tree shows a loading skeleton while the script reads it hidden, and the tree after", async () => {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3 });
  const seen: string[] = [];
  const view = tree.document.defaultView;
  assert.ok(view);
  new view.MutationObserver(() => {
    seen.push(
      `${String(tree.scroller.classList.contains(LOADING_CLASS))}:${String(tree.scroller.getAttribute("aria-busy"))}`,
    );
  }).observe(tree.scroller, { attributeFilter: ["class", "aria-busy"] });
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
  assert.ok(seen.includes("true:true"), "the skeleton showed during the walk");
  assert.equal(tree.scroller.classList.contains(LOADING_CLASS), false);
  assert.equal(tree.scroller.getAttribute("aria-busy"), null);
});

test("the skeleton shows from the first sync, while the changed files load, so the unfolded tree never shows", () => {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3 });
  const viewed = createViewedFiles({
    client: clientFor(CHANGED_PATHS),
    document: tree.document,
    drawTimeoutMs: TIMEOUT_MS,
    tickTimeoutMs: TIMEOUT_MS,
  });
  viewed.sync(PULL_REQUEST);
  assert.equal(tree.scroller.classList.contains(LOADING_CLASS), true);
  assert.equal(tree.scroller.getAttribute("aria-busy"), "true");
});

test("the skeleton goes away when the pull request has no changed files to load", async () => {
  const tree = createVirtualTree({ changedPaths: CHANGED_PATHS, rowsInView: 3 });
  const viewed = createViewedFiles({
    client: { ...clientFor(CHANGED_PATHS), getPullRequestIterationIds: async () => [] },
    document: tree.document,
    drawTimeoutMs: TIMEOUT_MS,
    tickTimeoutMs: TIMEOUT_MS,
  });
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  assert.equal(tree.scroller.classList.contains(LOADING_CLASS), false);
  assert.equal(tree.scroller.getAttribute("aria-busy"), null);
});
