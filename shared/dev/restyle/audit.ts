// Usage: npm run restyle:audit <script> [--widths 1280,1900] [--scale 1.6] [name ...]
// Opens every audit page of <script>/restyle/states.ts at each width, saves a screenshot to
// .restyle-runs/audit-<start>/ and prints what scrolls sideways, painted rounded corners and
// blurred outer shadows. Look at the screenshots too: the finds list only what a script can see.
// A scale of 1.6 at 1800 wide is a 2x screen at 80% zoom in a 1440 window.
import { RUNS_FOLDER, openFakeSitePage, resetFakeSite, restyleContext } from "./restyle-browser.ts";
import { restyleConfig, runStamp } from "./restyle-script.ts";
import type { Browser } from "playwright";
import type { RestyleConfig } from "./restyle-config.ts";
import { auditFinds } from "./audit-page.ts";
import { chromium } from "playwright";
import fs from "node:fs";
import { inSequence } from "./in-sequence.ts";
import { parseArgs } from "node:util";
import path from "node:path";

const AUDIT_HEIGHT = 800;
const FINDS_SHOWN = 6;

interface Audit {
  browser: Browser;
  scriptId: string;
  config: RestyleConfig;
  scale: number;
  out: string;
  only: string[];
}

/** Opens every audit page at one width and prints its finds. */
async function auditWidth(audit: Audit, width: number): Promise<void> {
  const context = await restyleContext({ ...audit, viewport: { height: AUDIT_HEIGHT, width } });
  const page = await context.newPage();
  const targets = audit.config.auditPages.filter(
    (target) => audit.only.length === 0 || audit.only.includes(target.name),
  );
  await inSequence(targets, async (target) => {
    await openFakeSitePage(page, target);
    await page.screenshot({ path: path.join(audit.out, `${target.name}-${width}.png`) });
    const { finds, pageOverflow } = await page.evaluate(auditFinds);
    await resetFakeSite(page);
    console.log(`${target.name}@${width}: page overflow ${pageOverflow}, ${finds.length} finds`);
    for (const find of finds.slice(0, FINDS_SHOWN)) {
      console.log(`  ${find}`);
    }
  });
  await context.close();
}

/** Audits every width, writing the screenshots to `out`. */
async function auditAll(audit: Omit<Audit, "browser">, widths: number[]): Promise<void> {
  fs.mkdirSync(audit.out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    await inSequence(widths, async (width) => auditWidth({ ...audit, browser }, width));
  } finally {
    await browser.close();
  }
  console.log(`screenshots: ${path.relative(process.cwd(), audit.out)}`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    scale: { default: "1", type: "string" },
    widths: { default: "1280,1900", type: "string" },
  },
});
const [scriptId, ...only] = positionals;
if (scriptId === undefined) {
  throw new Error(
    "usage: npm run restyle:audit <script> [--widths 1280,1900] [--scale 1.6] [name ...]",
  );
}
await auditAll(
  {
    config: await restyleConfig(scriptId),
    only,
    out: path.join(RUNS_FOLDER, `audit-${runStamp()}`),
    scale: Number(values.scale),
    scriptId,
  },
  values.widths.split(",").map(Number),
);
