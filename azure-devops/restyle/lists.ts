// Windows 98 mode's pull request list states: the card list, its filter bar and the inbox's side
// bar, and the lists as a table. Dev file only.
import type { DiffState } from "../../shared/dev/restyle/restyle-config.ts";
import type { Page } from "playwright";
import { REPO_ROOT } from "../../build/scripts.ts";
import fs from "node:fs";
import path from "node:path";

const LIST = "/fake-org/text-2/_git/text-16/pullrequests";
const INBOX = "/fake-org/_pulls";
const FIXTURES = path.join(REPO_ROOT, "azure-devops", "fixtures");
/** The card list, as Pull requests as a table is on unless the owner turns it off. */
const CARD_LIST = 'GM_setValue("table-rows-on", false);';
/** The section cards, where the table states differ from the card list's. */
const TABLE_CLIP = { height: 670, width: 1020, x: 240, y: 130 };
/** Pipeline icons are glyph boxes in the table artboards. */
const TABLE_MASK = ".fix-ado-pipeline-status { visibility: hidden !important; }";

/** The Mine tab's filter bar, open: the Active tab's bar and page CSS, as no capture has it open. */
async function openMineFilter(page: Page): Promise<void> {
  const active = fs.readFileSync(path.join(FIXTURES, "pr-list-win98-active.html"), "utf8");
  const start = active.indexOf(
    '<div class="page-content-left page-content-right page-content-top">',
  );
  const bar = active.slice(start, active.indexOf('<div class="page-content ', start));
  const css = fs.readFileSync(path.join(FIXTURES, "pr-list-win98-active.css"), "utf8");
  await page.evaluate(
    ([html, sheet]) => {
      document.head.prepend(Object.assign(document.createElement("style"), { textContent: sheet }));
      document.querySelector(".bolt-page > .bolt-tabbar")?.insertAdjacentHTML("afterend", html);
    },
    [bar, css],
  );
}

const listStates: DiffState[] = [
  {
    artboard: "PullRequests",
    capture: "win98",
    init: CARD_LIST,
    name: "list",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsActive",
    capture: "win98-active",
    init: CARD_LIST,
    name: "list-active",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsGrouped",
    capture: "win98",
    init: `${CARD_LIST} GM_setValue("linked-work-item-grouped", true);`,
    name: "list-grouped",
    page: "pr-list",
    path: LIST,
  },
  {
    act: openMineFilter,
    artboard: "PullRequestsMineFilter",
    capture: "win98",
    init: CARD_LIST,
    name: "list-mine-filter-open",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsInbox",
    capture: "win98",
    clip: { height: 750, width: 220, x: 0, y: 50 },
    init: CARD_LIST,
    name: "inbox-sidebar",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    artboard: "PullRequestsTable",
    capture: "win98",
    clip: TABLE_CLIP,
    mask: TABLE_MASK,
    name: "list-table",
    page: "pr-list",
    path: LIST,
  },
  {
    artboard: "PullRequestsTableInbox",
    capture: "assigned-active-empty",
    clip: TABLE_CLIP,
    mask: TABLE_MASK,
    name: "inbox-table",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    artboard: "PullRequestsTableInboxGrouped",
    capture: "assigned-active-empty",
    clip: TABLE_CLIP,
    init: 'GM_setValue("linked-work-item-grouped", true);',
    mask: TABLE_MASK,
    name: "inbox-table-grouped",
    page: "pr-inbox",
    path: INBOX,
  },
];

export { INBOX, LIST, listStates };
