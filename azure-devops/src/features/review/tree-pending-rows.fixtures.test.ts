import { KEY, loadReviewPage, settle } from "./review.test-page.ts";
import type { ReviewPage } from "./review.test-page.ts";
import assert from "node:assert/strict";
import { fixtures } from "../../pull-requests/captured-pull-request.test-page.ts";
import { test } from "node:test";

const { skip } = fixtures;
const TREE_ROW = ".repos-changes-explorer-tree tr.bolt-tree-row";
const PENDING_ROW = ".fix-ado-review-tree-row";
const THREAD_ITEM = ".repos-file-explorer-tree-thread-item";

interface TreePage {
  page: ReviewPage;
  /** The row of the file that has a posted thread, and the thread's row under it. */
  fileRow: Element;
  threadRow: Element;
  /** The names of the tree rows down to the file, by level. */
  names: string[];
  comment: (filePath: string, content: string) => string;
}

function nameOf(row: Element): string {
  return row.querySelector(".bolt-tree-cell .text-ellipsis")?.textContent.trim() ?? "";
}

function indentOf(row: Element | undefined): string {
  return row?.querySelector<HTMLElement>(`${THREAD_ITEM} > span`)?.style.marginLeft ?? "";
}

/** The captured Files tab whose tree shows a file with a posted thread. */
function treePage(): TreePage {
  const page = loadReviewPage("pr-files-thread");
  const rows = [...page.document.querySelectorAll(TREE_ROW)];
  const threadRow = rows.find((row) => row.querySelector(THREAD_ITEM) !== null);
  const fileRow = threadRow?.previousElementSibling ?? null;
  assert.ok(threadRow !== undefined && fileRow !== null);
  const names: string[] = [];
  for (const row of rows.slice(0, rows.indexOf(fileRow) + 1)) {
    names.length = Number(row.getAttribute("aria-level")) - 1;
    names.push(nameOf(row));
  }
  return {
    comment: (filePath, content) =>
      page.store.add(KEY, {
        anchor: { filePath, iteration: null, line: 12, lineLength: 30, side: "right" },
        content,
      }).id,
    fileRow,
    names,
    page,
    threadRow,
  };
}

test(
  "a pending comment shows in the file tree under its file, after the posted threads",
  { skip },
  () => {
    const { comment, names, page, threadRow } = treePage();
    comment(`/${names.join("/")}`, "Why this pattern?\nSecond line");
    page.sync();
    page.sync();
    const rows = [...page.document.querySelectorAll<HTMLElement>(PENDING_ROW)];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.previousElementSibling, threadRow);
    const dot = rows[0]?.querySelector<HTMLElement>(".fix-ado-review-pending-dot");
    assert.equal(dot?.title, "Pending comment");
    assert.equal(rows[0]?.querySelector(".text-ellipsis")?.textContent, "Why this pattern?");
    const threadIndent = threadRow.querySelector<HTMLElement>(".bolt-tree-expand-button")?.style
      .marginLeft;
    assert.equal(indentOf(rows[0]), threadIndent);
  },
);

test(
  "the tree's first row may name the repository, which a file's path leaves out",
  { skip },
  () => {
    const { comment, fileRow, names, page } = treePage();
    comment(`/${names.slice(1).join("/")}`, "First");
    comment("/no/such/file.ts", "Elsewhere");
    page.sync();
    const rows = [...page.document.querySelectorAll(PENDING_ROW)];
    assert.equal(rows.length, 1);
    let opened = 0;
    fileRow.addEventListener("click", () => {
      opened += 1;
    });
    rows[0]?.dispatchEvent(new (page.document.defaultView?.MouseEvent ?? MouseEvent)("click"));
    assert.equal(opened, 1);
  },
);

test("a deleted comment leaves the tree, and an edited one shows its new text", { skip }, () => {
  const { comment, names, page } = treePage();
  const id = comment(`/${names.join("/")}`, "First wording");
  page.sync();
  page.store.change(KEY, id, { content: "Better wording" });
  page.sync();
  assert.deepEqual(
    [...page.document.querySelectorAll(`${PENDING_ROW} .text-ellipsis`)].map(
      (text) => text.textContent,
    ),
    ["Better wording"],
  );
  page.store.remove(KEY, id);
  page.sync();
  assert.equal(page.document.querySelector(PENDING_ROW), null);
});

/** The captured tree scrolled down: the first rows are not drawn, so the selected file's path has no start. */
function scrolledTreePage(): { page: ReviewPage; fileRow: Element; filePath: string } {
  const page = loadReviewPage("pr-files-scrolled-tree");
  const rows = [...page.document.querySelectorAll(TREE_ROW)];
  const fileRow = rows.find((row) => row.classList.contains("selected"));
  assert.ok(fileRow !== undefined && Number(rows[0]?.getAttribute("aria-level")) > 1);
  const names: string[] = [];
  for (const row of rows.slice(0, rows.indexOf(fileRow) + 1)) {
    names.length = Number(row.getAttribute("aria-level")) - 1;
    names.push(nameOf(row));
  }
  const drawn = names.filter((name) => (name as string | undefined) !== undefined);
  return { filePath: `/not-drawn/${drawn.join("/")}`, fileRow, page };
}

function addComment(page: ReviewPage, filePath: string): void {
  page.store.add(KEY, {
    anchor: { filePath, iteration: null, line: 12, lineLength: 30, side: "right" },
    content: "Why this pattern?",
  });
}

test(
  "in a tree scrolled down, a pending comment shows under the one changed file its row can be",
  { skip },
  async () => {
    const { fileRow, filePath, page } = scrolledTreePage();
    page.changedPaths.push(filePath, "/not-drawn/another/file.ts");
    addComment(page, filePath);
    page.sync();
    assert.equal(page.document.querySelector(PENDING_ROW), null);
    await settle();
    assert.equal(page.document.querySelector(PENDING_ROW)?.previousElementSibling, fileRow);
  },
);

test(
  "in a tree scrolled down, a row that two changed files could be gets no pending comment",
  { skip },
  async () => {
    const { filePath, page } = scrolledTreePage();
    page.changedPaths.push(filePath, filePath.replace("/not-drawn/", "/elsewhere/"));
    addComment(page, filePath);
    page.sync();
    await settle();
    assert.equal(page.document.querySelector(PENDING_ROW), null);
  },
);

/** Takes rows out of the page, as the tree does with rows that scroll out of view. */
function undraw(rows: Element[]): void {
  for (const row of rows) {
    row.remove();
  }
}

const ROW_HEIGHT = 36;

/** Gives the tree's rows a place on the page, one under the other, with the tree scrolled to `scrollTop`. */
function layOut(page: ReviewPage, scrollTop: number): HTMLElement {
  const scroller = page.document
    .querySelector(".repos-changes-explorer-tree")
    ?.closest<HTMLElement>(".v-scroll-auto");
  const view = page.document.defaultView;
  assert.ok(scroller !== null && scroller !== undefined && view !== null);
  scroller.scrollTop = scrollTop;
  scroller.getBoundingClientRect = (): DOMRect => new view.DOMRect(0, 0, 0, ROW_HEIGHT);
  view.HTMLTableRowElement.prototype.getBoundingClientRect =
    function getBoundingClientRect(): DOMRect {
      const place = [...page.document.querySelectorAll(TREE_ROW)].indexOf(this);
      return new view.DOMRect(0, place * ROW_HEIGHT - scroller.scrollTop, 0, ROW_HEIGHT);
    };
  return scroller;
}

/** How far the script shifted the tree, as its top margin. */
function shiftOf(page: ReviewPage): string {
  return (
    page.document.querySelector<HTMLElement>(".repos-changes-explorer-tree")?.style.marginTop ?? ""
  );
}

/** The captured tree with two pending rows that just came above the part in view. */
function pageWithRowsAboveView(): TreePage & { scroller: HTMLElement; scrollTop: number } {
  const tree = treePage();
  const { comment, names, page, threadRow } = tree;
  const rows = [...page.document.querySelectorAll(TREE_ROW)];
  // The file's row is just above the part in view.
  const scrollTop = (rows.indexOf(threadRow) + 1) * ROW_HEIGHT;
  const scroller = layOut(page, scrollTop);
  comment(`/${names.join("/")}`, "First");
  comment(`/${names.join("/")}`, "Second");
  page.sync();
  return { ...tree, scrollTop, scroller };
}

test(
  "pending rows that come or go above the part in view shift the tree back, and scroll nothing",
  { skip },
  () => {
    const { fileRow, page, scrollTop, scroller, threadRow } = pageWithRowsAboveView();
    assert.deepEqual([shiftOf(page), scroller.scrollTop], ["-72px", scrollTop]);
    undraw([fileRow, threadRow]);
    page.sync();
    assert.equal(page.document.querySelector(PENDING_ROW), null);
    assert.deepEqual([shiftOf(page), scroller.scrollTop], ["", scrollTop]);
  },
);

test("the shift wears off while the owner scrolls", { skip }, () => {
  const { page, scrollTop, scroller } = pageWithRowsAboveView();
  const scrolled = 40;
  scroller.scrollTop = scrollTop + scrolled;
  scroller.dispatchEvent(new (page.document.defaultView?.Event ?? Event)("scroll"));
  assert.equal(shiftOf(page), "-62px");
  scroller.scrollTop = 0;
  scroller.dispatchEvent(new (page.document.defaultView?.Event ?? Event)("scroll"));
  assert.equal(shiftOf(page), "");
});

test("a pending row that comes under the part in view shifts nothing", { skip }, () => {
  const { comment, names, page } = treePage();
  layOut(page, 0);
  comment(`/${names.join("/")}`, "First");
  page.sync();
  assert.equal(page.document.querySelectorAll(PENDING_ROW).length, 1);
  assert.equal(shiftOf(page), "");
});

/** The captured tree with a pending comment on a file, whose folder the owner then folds. */
async function pageWithFoldedFolder(): Promise<TreePage & { folder: Element; rows: Element[] }> {
  const tree = treePage();
  const { comment, fileRow, names, page, threadRow } = tree;
  const filePath = `/${names.join("/")}`;
  page.changedPaths.push(filePath, "/zzz/last.ts");
  comment(filePath, "First");
  page.sync();
  await settle();
  const rows = [...page.document.querySelectorAll(TREE_ROW)];
  const folder = rows[rows.indexOf(fileRow) - 1];
  assert.ok(folder !== undefined && nameOf(folder) === names.at(-2));
  // The tree drops the rows under a folded folder.
  folder.setAttribute("aria-expanded", "false");
  undraw([fileRow, threadRow]);
  page.sync();
  return { ...tree, folder, rows };
}

test("a pending comment under a folded folder gets no row", { skip }, async () => {
  const { page } = await pageWithFoldedFolder();
  assert.equal(page.document.querySelector(PENDING_ROW), null);
});

test("an unfolded folder shows its pending comments again", { skip }, async () => {
  const { fileRow, folder, page, threadRow } = await pageWithFoldedFolder();
  folder.setAttribute("aria-expanded", "true");
  folder.after(fileRow, threadRow);
  page.sync();
  assert.equal(page.document.querySelector(PENDING_ROW)?.previousElementSibling, threadRow);
});
