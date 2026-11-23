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
import { listedRows } from "../../pull-requests/file-tree/tree-listing.ts";
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

/** The outermost folders whose files are all ticked, and the folders with a file not ticked. */
function outermostViewed({ changedPaths, ticked }: { changedPaths: string[]; ticked: string[] }): {
  folded: string[];
  open: string[];
} {
  const files = new Set(changedPaths);
  const folders = listedRows(changedPaths)
    .map(({ path }) => path)
    .filter((path) => !files.has(path));
  const isViewed = (folder: string): boolean =>
    changedPaths
      .filter((path) => path.startsWith(`${folder}/`))
      .every((path) => ticked.includes(path));
  const viewed = folders.filter((folder) => isViewed(folder));
  return {
    folded: viewed.filter((folder) => !viewed.some((outer) => folder.startsWith(`${outer}/`))),
    open: folders.filter((folder) => !isViewed(folder)),
  };
}

const capsSoFar = (): number =>
  logEntries().filter(({ message }) => message.includes("hit its cap")).length;

test("folders that share names with others fold on load and on Collapse viewed, without a wait running out", async () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const capsBefore = capsSoFar();
    const pullRequest = sharedNamesPullRequest(seed);
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page at a time: they share the script log
    const { tree, viewed } = await startedPage({
      ...pullRequest,
      pageRows: 10,
      rowsInView: 28,
    });
    [...tree.document.querySelectorAll("button")]
      .find((button) => button.textContent === "Collapse viewed")
      ?.click();
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page at a time: they share the script log
    await viewed.idle();
    assert.equal(capsSoFar() - capsBefore, 0, `seed ${String(seed)}: no wait ran out its cap`);
    const { folded, open } = outermostViewed(pullRequest);
    assert.deepEqual(
      folded.filter((folder) => !tree.isFolded(folder)),
      [],
      `seed ${String(seed)}: every viewed folder folded`,
    );
    assert.deepEqual(
      open.filter((folder) => tree.isFolded(folder)),
      [],
      `seed ${String(seed)}: no other folder folded`,
    );
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

test("every card starts collapsed when every file is viewed, also of files in a folder folded before the tree drew them", async () => {
  const { tree } = await startedPage({ rowsInView: 2, ticked: CHANGED_PATHS });
  assert.deepEqual(
    CHANGED_PATHS.filter((path) => isCardOpen(tree.document, path)),
    [],
  );
  assert.deepEqual(
    ["/api", "/docs", "/web"].filter((folder) => !tree.isFolded(folder)),
    [],
  );
});

/** Clicks the chevron of a drawn folder row, as the owner does. */
function clickChevronOf(document: Document, name: string): void {
  const row = [...document.querySelectorAll("tr.bolt-tree-row")].find(
    (candidate) => candidate.querySelector(".text-ellipsis")?.textContent === name,
  );
  assert.ok(row, `the tree draws ${name}`);
  row.querySelector<HTMLElement>(".bolt-tree-expand-button")?.click();
}

test("a viewed folder Azure DevOps opens again to show a file folds again, until the owner opens or folds one", async () => {
  const { tree, viewed } = await startedPage({ ticked: CHANGED_PATHS });
  tree.reveal("/web/cart/basket.ts");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  await tree.settled();
  assert.equal(tree.isFolded("/web"), true, "folded again after the reveal");
  clickChevronOf(tree.document, "web");
  await tree.settled();
  viewed.sync(PULL_REQUEST);
  await viewed.idle();
  assert.equal(tree.isFolded("/web"), false, "the owner's open stays");
});
