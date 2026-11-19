// Windows 98 mode's failure-count checks: what a pixel diff cannot see. Dev file only.
import type { FailureCheck } from "../../shared/dev/restyle/restyle-config.ts";
import type { Page } from "playwright";
import { inSequence } from "../../shared/dev/restyle/in-sequence.ts";

const BOARD_PATH = "/fake-org/text-2/_boards/board/t/text-3/Stories";
const TEAL = "0,128,128";

async function showBoard(
  page: Page,
  board: { origin: string; capture: string; width: number },
): Promise<void> {
  await page.setViewportSize({ height: 800, width: board.width });
  await page.request.get(`${board.origin}/__dev/show-capture?page=board&name=${board.capture}`);
  await page.goto(board.origin + BOARD_PATH);
  await page.waitForTimeout(3000);
}

/** The colour of one screen pixel, as "r,g,b". */
async function pixelAt(page: Page, point: { left: number; top: number }): Promise<string> {
  const png = await page.screenshot({ clip: { height: 1, width: 1, x: point.left, y: point.top } });
  return page.evaluate(
    async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = new OffscreenCanvas(1, 1).getContext("2d");
      canvas?.drawImage(image, 0, 0);
      return [...(canvas?.getImageData(0, 0, 1, 1).data.slice(0, 3) ?? [])].join(",");
    },
    `data:image/png;base64,${png.toString("base64")}`,
  );
}

/** Scrolls the board to its right end; returns a point on the band, 40px from the right edge. */
function scrollBoardRight(): { left: number; top: number } | null {
  const wrapper = document.querySelector(".board-wrapper");
  const scroller = wrapper?.parentElement;
  if (!wrapper || !scroller) {
    return null;
  }
  scroller.scrollLeft = scroller.scrollWidth;
  return {
    left: Math.round(scroller.getBoundingClientRect().right - 40),
    top: Math.round(wrapper.getBoundingClientRect().top + 4),
  };
}

/** At 1280 wide, scrolled to its right end, the board's band is teal up to the edge; at 1900 wide,
    where the native board needs no sideways scroll, the board needs none either. */
const boardWidth: FailureCheck = {
  async failures(page, origin) {
    const failures: string[] = [];
    await showBoard(page, { capture: "win98-settings", origin, width: 1280 });
    const band = await page.evaluate(scrollBoardRight);
    const color = band ? await pixelAt(page, band) : "no board";
    if (color !== TEAL) {
      failures.push(`scrolled right, the band is ${color}, not teal`);
    }
    await showBoard(page, { capture: "win98-settings", origin, width: 1900 });
    const [scrollWidth, clientWidth] = await page.evaluate(() => {
      const scroller = document.querySelector(".board-wrapper")?.parentElement;
      return scroller ? [scroller.scrollWidth, scroller.clientWidth] : [0, 0];
    });
    if (scrollWidth > clientWidth) {
      failures.push(`at 1900 wide the board scrolls sideways: ${scrollWidth} > ${clientWidth}`);
    }
    return failures;
  },
  name: "board-width-failures",
};

/** Invented rows for the board's other filter drop-downs, built on the real one. */
const DROP_DOWN_ROWS: [kind: string, names: string[]][] = [
  ["text", ["Active", "Resolved", "Closed", "New", "Removed"]],
  ["icon", ["Bug", "Feature", "Task", "User Story", "Epic"]],
  [
    "long",
    [
      "A name long enough to run past the drop-down's right edge",
      "Short",
      "Another quite long iteration path name",
      "Tag",
      "Last",
    ],
  ],
];

/** Fills the real drop-down with invented rows, every other one checked. Runs in the browser. */
function fillDropDown([kind, names]: [string, string[]]): void {
  const rows = [...document.querySelectorAll(".work-item-filter-dropdown li.bolt-list-row")];
  for (const extra of rows.slice(names.length)) {
    extra.remove();
  }
  const icon =
    kind === "icon"
      ? '<span class="fluent-icons-enabled"><span class="fabric-icon ms-Icon--Bug" style="display:inline-block;width:16px;height:16px"></span></span>'
      : "";
  for (const [index, row] of rows.slice(0, names.length).entries()) {
    const child = row.querySelector(".bolt-list-cell-child");
    const box = row.querySelector(".bolt-checkbox");
    const checked = index % 2 === 0;
    if (child) {
      child.innerHTML = `${icon}<span class="text-ellipsis body-m">${names[index]}</span>`;
    }
    row.classList.toggle("selected", checked);
    box?.classList.toggle("checked", checked);
    box?.setAttribute("aria-checked", String(checked));
  }
}

/** What is wrong with one hovered row of the drop-down. Runs in the browser. */
function hoveredRowFailures(index: number): string[] {
  const row = document.querySelectorAll(".work-item-filter-dropdown li.bolt-list-row")[index];
  const box = row.getBoundingClientRect();
  const failures = [...row.querySelectorAll("*")]
    .map((part) => part.getBoundingClientRect())
    .filter(
      (part) => part.height > 0 && (part.top < box.top - 0.01 || part.bottom > box.bottom + 0.01),
    )
    .map((part) => `a part at ${part.top}-${part.bottom} is outside ${box.top}-${box.bottom}`);
  const mark = row.querySelector(".bolt-checkmark");
  if (mark && mark.getBoundingClientRect().top % 1 !== 0) {
    failures.push("the checkbox is off whole pixels");
  }
  const text = row.querySelector(".text-ellipsis");
  if (
    getComputedStyle(row).backgroundColor !== "rgb(0, 0, 128)" ||
    (text && getComputedStyle(text).color !== "rgb(255, 255, 255)")
  ) {
    failures.push("hovered, it is not navy with white text");
  }
  if (
    row.querySelector(".bolt-checkbox")?.getAttribute("aria-checked") === "true" &&
    mark &&
    !getComputedStyle(mark).backgroundImage.includes("svg")
  ) {
    failures.push("checked, its box has no check");
  }
  return failures;
}

/** Hovers each row of one variant and lists what is wrong. */
async function variantFailures(
  page: Page,
  origin: string,
  variant: [string, string[]],
): Promise<string[]> {
  await showBoard(page, { capture: "win98-board-filter-with-hover", origin, width: 1280 });
  await page.evaluate(fillDropDown, variant);
  const perRow = await inSequence([...variant[1].keys()], async (index) => {
    await page.locator(".work-item-filter-dropdown li.bolt-list-row").nth(index).hover();
    await page.waitForTimeout(100);
    const found = await page.evaluate(hoveredRowFailures, index);
    return found.map((failure) => `${variant[0]} row ${index + 1}: ${failure}`);
  });
  return perRow.flat();
}

/** The board's other filter drop-downs: rows fit, a hovered row is navy, checked boxes keep their check. */
const dropDownVariants: FailureCheck = {
  async failures(page, origin) {
    const perVariant = await inSequence(DROP_DOWN_ROWS, async (variant) =>
      variantFailures(page, origin, variant),
    );
    return perVariant.flat();
  },
  name: "dropdown-variant-failures",
};

export { boardWidth, dropDownVariants };
