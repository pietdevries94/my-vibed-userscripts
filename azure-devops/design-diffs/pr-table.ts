// Usage: node azure-devops/design-diffs/pr-table.ts [state ...]
// Diffs each pull request section card on the fake site, header and list,, with Pull requests as a table on, against design B
// of the inbox redesigns drawn with the same rows. Writes both screenshots of each table to
// .restyle-runs/pr-table-<start>/ and prints one "state#table percent" line each. What stays is
// glyph anti-aliasing, a few dozen pixels a table.
// Run `npm run dev azure-devops` first, and save design B's page as azure-devops/design/pr-table.html.
import type { Browser, BrowserContext, Page } from "playwright";
import {
  RUNS_FOLDER,
  fileUrl,
  openFakeSitePage,
  resetFakeSite,
  restyleContext,
} from "../../shared/dev/restyle/restyle-browser.ts";
import type { DesignTable } from "./pr-table-rows.ts";
import type { FakeSitePage } from "../../shared/dev/restyle/restyle-config.ts";
import { READ_TABLES_SCRIPT } from "./pr-table-rows.ts";
import { REPO_ROOT } from "../../build/scripts.ts";
import { chromium } from "playwright";
import fs from "node:fs";
import { inSequence } from "../../shared/dev/restyle/in-sequence.ts";
import path from "node:path";
import { pixelDiff } from "../../shared/dev/restyle/pixel-diff.ts";
import { runStamp } from "../../shared/dev/restyle/restyle-script.ts";

const DESIGN_SOURCE = path.join(REPO_ROOT, "azure-devops", "design", "pr-table.html");
const VIEWPORT = { height: 1100, width: 1280 };
const INBOX = "/fake-org/_pulls";
const LIST = "/fake-org/text-2/_git/text-16/pullrequests";

/** Font icons and images differ by nature; the capture's own stale group rows are not the script's. */
const SITE_MASK = `img, .fabric-icon, [class*="ms-Icon"], .bolt-coin-content.using-image { visibility: hidden !important; }
  table.repos-pr-list > tbody > tr:not([class]) { display: none !important; }`;
const DESIGN_MASK = ".t-comment-icon, .vote, .chev { visibility: hidden !important; }";

interface TableState extends FakeSitePage {
  name: string;
  isGrouped: boolean;
  /** Only these cards, by index, where the capture's other cards hold marks of its own. */
  cards?: number[];
}

const STATES: TableState[] = [
  {
    capture: "assigned-active-inbox",
    isGrouped: true,
    name: "inbox-grouped",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    capture: "assigned-active-inbox",
    isGrouped: false,
    name: "inbox-plain",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    capture: "assigned-waiting-inbox",
    isGrouped: true,
    name: "inbox-waiting-grouped",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    // The capture was made with the script on: its stacked cards hold the script's title marks.
    capture: "unread-prs",
    cards: [0],
    isGrouped: true,
    name: "inbox-marked-grouped",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    capture: "unread-prs",
    cards: [0],
    isGrouped: false,
    name: "inbox-marked-plain",
    page: "pr-inbox",
    path: INBOX,
  },
  {
    capture: "assigned-active",
    isGrouped: true,
    name: "list-grouped",
    page: "pr-list",
    path: LIST,
  },
  { capture: "assigned-active", isGrouped: false, name: "list-plain", page: "pr-list", path: LIST },
];

interface Run {
  browser: Browser;
  shots: string;
  designPage: string;
}

/** The artifact page leaves the doctype to its host; without one it renders in quirks mode,
 *  whose line heights differ from the site's. Returns the page with one. */
function writeDesignPage(): string {
  if (!fs.existsSync(DESIGN_SOURCE)) {
    throw new Error(`design B is missing: save it as ${DESIGN_SOURCE}`);
  }
  const page = path.join(RUNS_FOLDER, "design", "pr-table.html");
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, `<!doctype html>\n${fs.readFileSync(DESIGN_SOURCE, "utf8")}`);
  return page;
}

async function stateContext(run: Run, state: TableState): Promise<BrowserContext> {
  const settings = { "linked-work-item-grouped": state.isGrouped, "table-rows-on": true };
  const config = {
    auditPages: [],
    checks: [],
    masks: { design: "", site: "" },
    settings,
    states: [],
  };
  return restyleContext({
    browser: run.browser,
    config,
    scriptId: "azure-devops",
    viewport: VIEWPORT,
  });
}

/** Screenshots of each element the selector finds, in order. */
async function shootEach(
  page: Page,
  selector: string,
  file: (index: number) => string,
): Promise<Buffer[]> {
  const count = await page.locator(selector).count();
  return inSequence([...Array.from({ length: count }).keys()], async (index) =>
    page
      .locator(selector)
      .nth(index)
      .screenshot({ path: file(index) }),
  );
}

/** The fake site's tables: what they show, and their screenshots. */
async function siteTables(
  run: Run,
  state: TableState,
  page: Page,
): Promise<{ tables: DesignTable[]; shots: Buffer[] }> {
  await openFakeSitePage(page, state);
  await page.addStyleTag({ content: SITE_MASK });
  const tables: DesignTable[] = await page.evaluate(READ_TABLES_SCRIPT);
  const shots = await shootEach(page, ".repos-pr-section-card:has(table.repos-pr-list)", (index) =>
    path.join(run.shots, `${state.name}-${index}-site.png`),
  );
  await resetFakeSite(page);
  return { shots, tables };
}

/** The design's tables, drawn with the site's rows. */
async function designTables(
  run: Run,
  state: TableState & { tables: DesignTable[] },
  page: Page,
): Promise<Buffer[]> {
  await page.addInitScript(`window.FIX_ADO_DESIGN_TABLES = ${JSON.stringify(state.tables)};`);
  await page.goto(fileUrl(run.designPage));
  await page.addStyleTag({ content: DESIGN_MASK });
  return shootEach(page, ".fix-ado-design-card", (index) =>
    path.join(run.shots, `${state.name}-${index}-design.png`),
  );
}

/** Each table's diff line for one state. */
async function diffState(run: Run, state: TableState): Promise<string[]> {
  const context = await stateContext(run, state);
  try {
    const site = await siteTables(run, state, await context.newPage());
    const page = await context.newPage();
    const design = await designTables(run, { ...state, tables: site.tables }, page);
    const indexes = [...design.keys()].filter((index) => state.cards?.includes(index) ?? true);
    return await inSequence(indexes, async (index) => {
      const diff = await pixelDiff(page, design[index], site.shots[index]);
      const value = diff.sizes
        ? `size ${diff.sizes.join(" vs ")}`
        : `${diff.percent}% (${diff.pixels} px)`;
      console.log(`${state.name}#${index} ${value}`);
      return `${state.name}#${index} ${value}`;
    });
  } finally {
    await context.close();
  }
}

const only = process.argv.slice(2);
const shots = path.join(RUNS_FOLDER, `pr-table-${runStamp()}`);
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const run = { browser, designPage: writeDesignPage(), shots };
  const states = STATES.filter((state) => only.length === 0 || only.includes(state.name));
  const lines = await inSequence(states, async (state) => diffState(run, state));
  fs.writeFileSync(`${shots}.txt`, `${lines.flat().join("\n")}\n`);
  console.log(`${path.relative(process.cwd(), shots)}.txt`);
} finally {
  await browser.close();
}
