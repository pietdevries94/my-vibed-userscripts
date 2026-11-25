// Windows 98 mode's thread states and the title bar check: a thread's title bar is one line,
// with its coin and text inside it, also for a long author name. Dev file only.
import type { DiffState, FailureCheck } from "../../shared/dev/restyle/restyle-config.ts";
import { OVERVIEW_PATH } from "./checks.ts";
import type { Page } from "playwright";
import { inSequence } from "../../shared/dev/restyle/in-sequence.ts";

const GENERAL_THREAD = ".activity-feed-list .repos-discussion-thread:not(.comment-file-header + *)";
/** Where the artboards put the general thread's timeline row. */
const GENERAL_THREAD_TOP = 600;
/** An invented author, as long as the build service accounts that start threads. */
const LONG_NAME = "Project Collection Build Service (example-collection)";

/** The capture keeps the script's toggles without listeners: drop them, so it adds live ones. */
async function replaceDeadToggles(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const toggle of document.querySelectorAll(
      ".fix-ado-thread-toggle, .fix-ado-push-toggle",
    )) {
      toggle.remove();
    }
  });
  await page.waitForTimeout(800);
}

/** Scrolls the general thread's row to where the artboards put it. Runs in the browser. */
function scrollToGeneralThread({ selector, top }: { selector: string; top: number }): void {
  const row = document.querySelector(selector)?.closest("tr");
  const scroller = document.querySelector(".repos-pr-details-page");
  if (row && scroller) {
    scroller.scrollTop += row.getBoundingClientRect().top - top;
  }
}

/** Closes the general thread and gives it a reply from its author. Runs in the browser. */
function closeWithReply(selector: string): void {
  const general = document.querySelector(selector);
  const first = general?.querySelector(".repos-comment-viewer");
  const reply = first?.cloneNode(true);
  if (first && reply instanceof Element) {
    for (const part of reply.querySelectorAll(
      ".fix-ado-thread-toggle, .fix-ado-thread-chip, .bolt-expandable-button",
    )) {
      part.remove();
    }
    first.after(reply);
    reply.querySelector(".markdown-content")?.replaceChildren("Coverage went up by 0.6 points.");
  }
  const status = general?.querySelector(".bolt-dropdown-expandable-button-label");
  if (status) {
    status.textContent = "Closed";
  }
}

/**
 * Gives every comment the long author name and an initials coin, with the time under the name
 * as Azure DevOps shows it in a narrow window. Runs in the browser.
 */
function giveAuthorsLongNames(name: string): void {
  for (const viewer of document.querySelectorAll(".activity-feed-list .repos-comment-viewer")) {
    const author = viewer.querySelector(".repos-discussion-comment-header .padding-right-8");
    const coin = viewer.querySelector(".bolt-coin");
    const nameAndTime = viewer.querySelector(".repos-discussion-comment-header > .scroll-hidden");
    if (author && coin && nameAndTime) {
      author.textContent = name;
      coin.setAttribute("aria-label", name);
      coin.className = "bolt-coin flex-noshrink repos-comment-header-persona size32";
      coin.innerHTML =
        '<div class="bolt-coin-content size32" style="background: rgb(170, 30, 160)">PB</div>';
      nameAndTime.className = "scroll-hidden flex-column";
    }
  }
}

/** The general thread open, scrolled to where the MainGeneralOpen artboard puts it. */
async function showGeneralThread(page: Page): Promise<void> {
  await replaceDeadToggles(page);
  await page.evaluate(scrollToGeneralThread, { selector: GENERAL_THREAD, top: GENERAL_THREAD_TOP });
  await page.waitForTimeout(400);
}

/** The bug's case, invented: a closed thread whose author has a long name, with a reply. */
async function showLongNameThread(page: Page): Promise<void> {
  await replaceDeadToggles(page);
  await page.evaluate(closeWithReply, GENERAL_THREAD);
  await page.evaluate(giveAuthorsLongNames, LONG_NAME);
  await page.waitForTimeout(400);
  // The script collapses a Closed thread; the artboard draws it open.
  await page.evaluate((selector) => {
    document
      .querySelector(`${selector}[data-fix-ado-thread="collapsed"] .fix-ado-thread-toggle`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, GENERAL_THREAD);
  await page.waitForTimeout(400);
  await page.evaluate(scrollToGeneralThread, { selector: GENERAL_THREAD, top: GENERAL_THREAD_TOP });
  await page.waitForTimeout(400);
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** One thread's title bar, measured in the browser. */
interface TitleBar {
  label: string;
  bar: Box | null;
  parts: { name: string; box: Box }[];
  /** The widest of the coin and its content; 0 for a file thread's bar, which has no coin. */
  coinWidth: number;
  /** The top of the first comment's text below the bar; null when collapsed. */
  textTop: number | null;
}

/** Each thread's title bar on the page: the bar, its parts, coin and the text below. Runs in the browser. */
function measureTitleBars(): TitleBar[] {
  return [
    ...document.querySelectorAll<HTMLElement>(".activity-feed-list [data-fix-ado-thread]"),
  ].map((thread, index) => {
    const isOpen = thread.dataset.fixAdoThread === "open";
    const fileHeader = isOpen
      ? thread.previousElementSibling?.querySelector(
          ":scope.comment-file-header .comment-file-header-title",
        )
      : null;
    const firstRow = thread.querySelector(
      ":scope > .repos-comment-viewer:first-child > .repos-discussion-comment > .flex-column > .flex-row",
    );
    // Collapsed, the first comment's whole row is the bar; open, its header spans the window.
    const commentBar = isOpen
      ? firstRow?.querySelector(".repos-discussion-comment-header")
      : firstRow;
    const bar = fileHeader ?? commentBar ?? null;
    const coins = fileHeader
      ? []
      : [
          ...(firstRow?.querySelectorAll(
            ":scope > div > .bolt-coin, :scope > div > .bolt-coin > *",
          ) ?? []),
        ];
    const parts = [
      ...(bar?.querySelectorAll(
        ".fix-ado-thread-toggle, .padding-right-8, .comment-file-header-link, time, .fix-ado-thread-chip",
      ) ?? []),
      ...coins,
    ];
    const text = isOpen ? thread.querySelector(".markdown-content") : null;
    const [barBox, ...partBoxes] = [bar ?? thread, ...parts].map((element) => {
      const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
      return { bottom, height, left, right, top, width };
    });
    return {
      bar: bar ? barBox : null,
      coinWidth: Math.max(0, ...coins.map((coin) => coin.getBoundingClientRect().width)),
      label: `thread ${index + 1} (${fileHeader ? "file" : "comment"}, ${thread.dataset.fixAdoThread})`,
      parts: parts.map((part, partIndex) => ({
        box: partBoxes[partIndex],
        name: part.className || part.tagName,
      })),
      textTop: text ? text.getBoundingClientRect().top : null,
    };
  });
}

const SLACK = 0.5;
const TITLE_BAR_HEIGHT = 18;
const COIN_SIZE = 16;

function isWithin(part: Box, bar: Box): boolean {
  return (
    part.top >= bar.top - SLACK &&
    part.bottom <= bar.bottom + SLACK &&
    part.left >= bar.left - SLACK &&
    part.right <= bar.right + SLACK
  );
}

/** What is wrong with one title bar. */
function titleBarFailures({ bar, coinWidth, label, parts, textTop }: TitleBar): string[] {
  if (bar === null) {
    return [`${label}: no title bar`];
  }
  const failures = parts
    .filter((part) => part.box.width > 0 && !isWithin(part.box, bar))
    .map((part) => `${label}: ${part.name} sticks out of the title bar`);
  if (Math.abs(bar.height - TITLE_BAR_HEIGHT) > SLACK) {
    failures.push(`${label}: the title bar is ${bar.height}px tall, not one 18px line`);
  }
  if (coinWidth > 0 && Math.round(coinWidth) !== COIN_SIZE) {
    failures.push(`${label}: the coin is ${coinWidth}px, not 16px`);
  }
  if (textTop !== null && textTop < bar.bottom - SLACK) {
    failures.push(`${label}: the comment overlaps the title bar`);
  }
  return failures;
}

/** Every thread of one capture, open and collapsed, at one width, as is and with long names. */
async function captureFailures(
  page: Page,
  origin: string,
  view: { capture: string; width: number; long: boolean },
): Promise<string[]> {
  await page.setViewportSize({ height: 800, width: view.width });
  await page.request.get(`${origin}/__dev/show-capture?page=pr-detail&name=${view.capture}`);
  await page.goto(origin + OVERVIEW_PATH);
  await page.waitForTimeout(3000);
  await replaceDeadToggles(page);
  if (view.long) {
    await page.evaluate(closeWithReply, GENERAL_THREAD);
    await page.evaluate(giveAuthorsLongNames, LONG_NAME);
    await page.waitForTimeout(400);
  }
  const perState = await inSequence(["as shown", "toggled"], async (state) => {
    if (state === "toggled") {
      await page.evaluate(() => {
        for (const toggle of document.querySelectorAll<HTMLElement>(".fix-ado-thread-toggle")) {
          toggle.click();
        }
      });
      await page.waitForTimeout(600);
    }
    const titleBars = await page.evaluate(measureTitleBars);
    const found = titleBars.flatMap((titleBar) => titleBarFailures(titleBar));
    const name = `${view.capture} ${view.width}${view.long ? " long names" : ""} ${state}`;
    return found.map((failure) => `${name}: ${failure}`);
  });
  await page.request.get(`${origin}/__dev/reset`);
  return perState.flat();
}

const VIEWS = ["wide", "reply-focused"].flatMap((capture) =>
  [1280, 900].flatMap((width) => [false, true].map((long) => ({ capture, long, width }))),
);

/** Every thread state's title bar: one 18px line, its coin and text inside it, nothing over it. */
const threadTitleBars: FailureCheck = {
  async failures(page, origin) {
    const perView = await inSequence(VIEWS, async (view) => captureFailures(page, origin, view));
    return perView.flat();
  },
  name: "thread-title-bar-failures",
};

/** The title bar, the toolbar and the comment down to its table header, which the artboards draw. */
const THREAD_CLIP = { height: 90, width: 628, x: 276, y: 596 };

const threadStates: DiffState[] = [
  {
    act: showGeneralThread,
    artboard: "MainGeneralOpen",
    capture: "wide",
    clip: THREAD_CLIP,
    name: "thread-open",
    page: "pr-detail",
    path: OVERVIEW_PATH,
  },
  {
    act: showLongNameThread,
    artboard: "MainThreadLongName",
    capture: "wide",
    clip: THREAD_CLIP,
    name: "thread-long-name",
    page: "pr-detail",
    path: OVERVIEW_PATH,
  },
];

export { threadStates, threadTitleBars };
