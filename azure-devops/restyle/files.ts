// Windows 98 mode's Files tab check: a long tree scrolls to its last file. Dev file only.
import type { FailureCheck } from "../../shared/dev/restyle/restyle-config.ts";

const FILES_PATH = "/fake-org/text-15/_git/text-16/pullrequest/1005?_a=files";

/** The tree pane's scroll height, and the height of the rows it draws plus its spacer rows,
 * which stand in for the rows it does not draw. Runs in the browser. */
function measureTree(): { scrollHeight: number; rowsHeight: number } {
  const scroller = document.querySelector(
    ".repos-changes-explorer-splitter .vss-Splitter--pane-fixed > .v-scroll-auto",
  );
  const tree = scroller?.querySelector(".repos-changes-explorer-tree");
  const spacersHeight = [...(tree?.querySelectorAll<HTMLElement>(".bolt-list-cell-spacer") ?? [])]
    .map((spacer) => Number(spacer.style.height.replace(/px$/u, "")) || 0)
    .reduce((sum, height) => sum + height, 0);
  const drawnHeight = [...(tree?.querySelectorAll("tr.bolt-tree-row") ?? [])]
    .map((row) => row.getBoundingClientRect().height)
    .reduce((sum, height) => sum + height, 0);
  return { rowsHeight: spacersHeight + drawnHeight, scrollHeight: scroller?.scrollHeight ?? 0 };
}

/** A pull request with hundreds of files: its tree pane scrolls as far as its rows reach. */
const treeScroll: FailureCheck = {
  async failures(page, origin) {
    await page.setViewportSize({ height: 800, width: 1280 });
    await page.request.get(`${origin}/__dev/show-capture?page=pr-files&name=large-pr`);
    await page.goto(origin + FILES_PATH);
    await page.waitForTimeout(3000);
    const { rowsHeight, scrollHeight } = await page.evaluate(measureTree);
    await page.request.get(`${origin}/__dev/reset`);
    if (rowsHeight === 0) {
      return ["the Files tree has no rows"];
    }
    return scrollHeight < rowsHeight
      ? [`the Files tree scrolls ${scrollHeight}px, short of its rows' ${Math.round(rowsHeight)}px`]
      : [];
  },
  name: "tree-scroll-failures",
};

export { treeScroll };
