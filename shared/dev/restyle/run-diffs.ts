// Usage: npm run restyle:diff <script> [name ...]
// Diffs every state in <script>/restyle/states.ts against its artboard, then runs the failure-count
// checks. Writes .restyle-runs/<script>-<start>.txt, one "name value" line each, and prints it with
// a summary; each state's two screenshots go to .restyle-runs/<script>-<start>/. Compare a run's
// start time with your last CSS change before you report it.
// Run `npm run dev <script>` first, and keep the artboards in <script>/design.
import type { Browser, Page } from "playwright";
import type { DiffState, FailureCheck, RestyleConfig } from "./restyle-config.ts";
import {
  FAKE_SITE_ORIGIN,
  RUNS_FOLDER,
  fileUrl,
  openFakeSitePage,
  resetFakeSite,
  restyleContext,
} from "./restyle-browser.ts";
import { restyleConfig, runStamp, writeArtboardPages } from "./restyle-script.ts";
import { chromium } from "playwright";
import fs from "node:fs";
import { inSequence } from "./in-sequence.ts";
import path from "node:path";
import { pixelDiff } from "./pixel-diff.ts";

const DEFAULT_VIEWPORT = { height: 800, width: 1280 };

interface Run {
  browser: Browser;
  scriptId: string;
  config: RestyleConfig;
  designPages: string;
  shots: string;
}

/** The artboard's screenshot, with its glyphs masked. */
async function designShot(run: Run, state: DiffState, page: Page): Promise<Buffer> {
  await page.goto(fileUrl(path.join(run.designPages, `${state.artboard}.html`)));
  await page.addStyleTag({ content: run.config.masks.design });
  return page.screenshot({
    clip: state.clip,
    path: path.join(run.shots, `${state.name}-design.png`),
  });
}

/** The fake site's screenshot of the state, with its font icons and images masked. */
async function siteShot(run: Run, state: DiffState, page: Page): Promise<Buffer> {
  await openFakeSitePage(page, state);
  await state.act?.(page);
  await page.addStyleTag({ content: `${run.config.masks.site}\n${state.mask ?? ""}` });
  const shot = await page.screenshot({
    clip: state.clip,
    path: path.join(run.shots, `${state.name}-site.png`),
  });
  await resetFakeSite(page);
  return shot;
}

/** The state's diff in percent, or why it could not be compared. */
async function diffState(run: Run, state: DiffState): Promise<string> {
  const context = await restyleContext({
    ...run,
    init: state.init,
    viewport: state.viewport ?? DEFAULT_VIEWPORT,
  });
  const page = await context.newPage();
  try {
    const design = await designShot(run, state, page);
    const diff = await pixelDiff(page, design, await siteShot(run, state, page));
    return diff.sizes ? `size ${diff.sizes.join(" vs ")}` : String(diff.percent);
  } finally {
    await context.close();
  }
}

/** The check's failure count; each failure is printed. */
async function runCheck(run: Run, check: FailureCheck): Promise<string> {
  const context = await restyleContext({ ...run, viewport: DEFAULT_VIEWPORT });
  const page = await context.newPage();
  try {
    const failures = await check.failures(page, FAKE_SITE_ORIGIN);
    await resetFakeSite(page);
    for (const failure of failures) {
      console.log(`  ${check.name}: ${failure}`);
    }
    return String(failures.length);
  } finally {
    await context.close();
  }
}

/** A result line, "name value", printed as it comes. */
function resultLine(name: string, value: string): string {
  console.log(`${name} ${value}`);
  return `${name} ${value}`;
}

/** The items named on the command line, or all of them when none are. */
function picked<Item extends { name: string }>(items: Item[], only: string[]): Item[] {
  return items.filter((item) => only.length === 0 || only.includes(item.name));
}

/** Each result line, in order: the states, then the checks. */
async function results(run: Run, only: string[]): Promise<string[]> {
  const states = await inSequence(picked(run.config.states, only), async (state) =>
    resultLine(state.name, await diffState(run, state)),
  );
  const checks = await inSequence(picked(run.config.checks, only), async (check) =>
    resultLine(check.name, await runCheck(run, check)),
  );
  return [...states, ...checks];
}

/** Runs the states and checks, writes .restyle-runs/<script>-<start>.txt and prints the summary. */
async function runAll(scriptId: string, config: RestyleConfig, only: string[]): Promise<void> {
  const designPages = writeArtboardPages(
    scriptId,
    picked(config.states, only).map((state) => state.artboard),
  );
  const started = runStamp();
  const shots = path.join(RUNS_FOLDER, `${scriptId}-${started}`);
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const lines = await results({ browser, config, designPages, scriptId, shots }, only);
    fs.writeFileSync(`${shots}.txt`, `${lines.join("\n")}\n`);
    console.log(
      `${path.relative(process.cwd(), shots)}.txt: ${lines.length} results, started ${started}`,
    );
  } finally {
    await browser.close();
  }
}

const [scriptId, ...only] = process.argv.slice(2);
if (scriptId === undefined) {
  throw new Error("usage: npm run restyle:diff <script> [name ...]");
}
await runAll(scriptId, await restyleConfig(scriptId), only);
