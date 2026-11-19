// Overview states on top of the shown capture: the check list of the capture with every
// check passed, and invented unread comments and new rows.
import type { FakeSiteAction } from "../../shared/dev/fake-site/server.ts";
import { JSDOM } from "jsdom";
import { fixtureReader } from "../../shared/dev/fake-site/server.ts";
import path from "node:path";

/** The status card's check list; the script's warnings box uses the same class. */
const CHECK_LIST_SELECTOR = ".status-details-container:not(.fix-ado-issue-box)";

const PASSED_FIXTURE = "pr-detail-win98-checks-passed.html";
const MENU_FIXTURE = "pr-detail-vote-menu.html";
/** An invented ⋮ menu: a disabled item and one with a submenu, on the captured menu's markup. */
const MORE_MENU_ITEMS = [
  { text: "Copy pull request link" },
  { text: "Open in new tab" },
  { disabled: true, text: "Restore source branch" },
  { text: "Share pull request" },
  { submenu: true, text: "Set auto-complete" },
];
const readFixture = fixtureReader(path.join(import.meta.dirname, ".."));
const variants = { allChecksPassed: false, moreMenu: false, unreadAndNew: false };

function setAllChecksPassed(on: boolean): string {
  variants.allChecksPassed = on;
  return on ? "Every required check passes." : "Checks as captured.";
}

/** Replaces the status card's check list with the one from the capture with every check passed. */
function showChecksPassed(document: Document): void {
  const container = document.querySelector(CHECK_LIST_SELECTOR);
  const passed = new JSDOM(readFixture(PASSED_FIXTURE)).window.document.querySelector(
    CHECK_LIST_SELECTOR,
  );
  if (container !== null && passed !== null) {
    container.innerHTML = passed.innerHTML;
  }
}

function setUnreadAndNew(on: boolean): string {
  variants.unreadAndNew = on;
  return on
    ? "The first file thread with two comments has both unread, and the next file thread has its comments unread; two updates after the first are new."
    : "Comments and updates as captured.";
}

/** The first file thread with two comments. */
function twoCommentFileThread(document: Document): Element | undefined {
  return [...document.querySelectorAll(".activity-feed-list .repos-discussion-thread")].find(
    (candidate) =>
      candidate.parentElement?.querySelector(":scope > .comment-file-header") !== null &&
      candidate.querySelectorAll(".repos-discussion-comment-header").length === 2,
  );
}

/** The file thread after the given one, for a second group of unread comments. */
function nextFileThread(document: Document, thread: Element): Element | undefined {
  const threads = [
    ...document.querySelectorAll(".activity-feed-list .repos-discussion-thread"),
  ].filter(
    (candidate) => candidate.parentElement?.querySelector(":scope > .comment-file-header") !== null,
  );
  return threads[threads.indexOf(thread) + 1];
}

/** Azure DevOps's mark of an unread comment: a dot before its time. */
function markCommentsUnread(thread: Element): void {
  for (const time of thread.querySelectorAll(".repos-discussion-comment-header time")) {
    const marker = thread.ownerDocument.createElement("div");
    marker.className = "repos-unread-comment-marker flex-noshrink";
    time.parentElement?.before(marker);
  }
}

/** Azure DevOps's mark of a new row, on the first two updates after the given row. */
function markUpdatesNew(document: Document, after: Element | null): void {
  const rows = [...document.querySelectorAll(".activity-feed-list .bolt-timeline-row")];
  const later = after === null ? [] : rows.slice(rows.indexOf(after) + 1);
  const updates = later.filter((row) => row.querySelector(".activity-card-subtle") !== null);
  for (const row of updates.slice(0, 2)) {
    row.querySelector(".activity-feed-sequence")?.classList.add("new");
  }
}

function showUnreadAndNew(document: Document): void {
  const thread = twoCommentFileThread(document);
  if (thread !== undefined) {
    markCommentsUnread(thread);
    const next = nextFileThread(document, thread);
    if (next !== undefined) {
      markCommentsUnread(next);
    }
    markUpdatesNew(document, thread.closest(".bolt-timeline-row"));
  }
}

function setMoreMenu(on: boolean): string {
  variants.moreMenu = on;
  return on ? "An invented ⋮ menu is open." : "No menu open.";
}

/** One row of the captured menu as an invented item. */
function showMenuItem(row: Element, item: (typeof MORE_MENU_ITEMS)[number]): void {
  const text = row.querySelector(".bolt-menuitem-cell-text");
  if (text !== null) {
    text.textContent = item.text;
  }
  row.classList.toggle("disabled", item.disabled === true);
  const last = row.lastElementChild?.firstElementChild;
  if (item.submenu === true && last) {
    last.innerHTML =
      '<span class="fluent-icons-enabled"><span class="fabric-icon ms-Icon--ChevronRightMed"></span></span>';
    last.classList.add("bolt-menuitem-cell-submenu");
  }
}

/** Opens the captured vote menu's callout with the invented ⋮ menu's items in it. */
function showMoreMenu(document: Document): void {
  const host = new JSDOM(readFixture(MENU_FIXTURE)).window.document.querySelector(
    ".bolt-portal-host",
  );
  if (host === null) {
    return;
  }
  const rows = host.querySelectorAll(".bolt-menuitem-row:not(.bolt-menuitem-divider)");
  for (const [index, item] of MORE_MENU_ITEMS.entries()) {
    const row = rows[index];
    if (row !== undefined) {
      showMenuItem(row, item);
    }
  }
  // Under the header's ⋮ button: the captured offsets belong to the vote menu's page, whose CSS also made it absolute.
  host
    .querySelector(".bolt-callout")
    ?.setAttribute("style", "position: absolute; right: 16px; top: 103px;");
  document.querySelector(".bolt-portal-host")?.replaceWith(document.importNode(host, true));
}

/** The Overview's HTML with the variants that are on. */
function withOverviewVariants(html: string): string {
  if (!variants.allChecksPassed && !variants.unreadAndNew && !variants.moreMenu) {
    return html;
  }
  const { document } = new JSDOM(html).window;
  if (variants.allChecksPassed) {
    showChecksPassed(document);
  }
  if (variants.unreadAndNew) {
    showUnreadAndNew(document);
  }
  if (variants.moreMenu) {
    showMoreMenu(document);
  }
  return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
}

function resetOverviewVariants(): void {
  setAllChecksPassed(false);
  setUnreadAndNew(false);
  setMoreMenu(false);
}

const overviewVariantActions: FakeSiteAction[] = [
  {
    description:
      "Every required check on the pull request page passes (on=1), or the checks show as captured (on=0).",
    example: "on=1",
    name: "all-checks-passed",
    run: (query) => setAllChecksPassed(query.get("on") === "1"),
  },
  {
    description:
      "Unread comments in two threads and two new updates on the pull request page (on=1), or none (on=0).",
    example: "on=1",
    name: "unread-and-new",
    run: (query) => setUnreadAndNew(query.get("on") === "1"),
  },
  {
    description:
      "An invented ⋮ menu open on the pull request page, with a disabled item and a submenu (on=1), or no menu (on=0).",
    example: "on=1",
    name: "more-menu",
    run: (query) => setMoreMenu(query.get("on") === "1"),
  },
];

export { overviewVariantActions, resetOverviewVariants, withOverviewVariants };
