// The browser the restyle tools drive: Chrome with the script's dev file, its settings and the
// fake site. Run `npm run dev <script>` first; it serves both. Dev file only.
import type { Browser, BrowserContext, Page } from "playwright";
import { DEV_SERVER_PORT, FAKE_SITE_PORT } from "../../../build/bundle.ts";
import type { FakeSitePage, RestyleConfig } from "./restyle-config.ts";
import { REPO_ROOT, readScript } from "../../../build/scripts.ts";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { userscriptLoaderScript } from "../fake-site/userscript-loader.ts";

const FAKE_SITE_ORIGIN = `http://localhost:${FAKE_SITE_PORT}`;
/** How long a fake-site page takes to load and let the script settle. */
const SETTLE_MS = 3000;

interface ContextOptions {
  browser: Browser;
  scriptId: string;
  config: RestyleConfig;
  viewport: { width: number; height: number };
  /** Device pixels per CSS pixel: 1.6 is a 2x screen at 80% zoom. */
  scale?: number;
  init?: string;
}

/** A browser context whose fake-site pages run the dev file with the config's settings. */
async function restyleContext(options: ContextOptions): Promise<BrowserContext> {
  const context = await options.browser.newContext({
    deviceScaleFactor: options.scale ?? 1,
    viewport: options.viewport,
  });
  const devFileUrl = `http://localhost:${DEV_SERVER_PORT}/${readScript(options.scriptId).id}.user.js`;
  await context.addInitScript(userscriptLoaderScript(devFileUrl, FAKE_SITE_ORIGIN));
  const settings = Object.entries(options.config.settings)
    .map(([key, value]) => `GM_setValue(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
    .join("");
  await context.addInitScript(
    `if (location.origin === ${JSON.stringify(FAKE_SITE_ORIGIN)}) { ${settings} ${options.init ?? ""} }`,
  );
  return context;
}

/** Shows the capture on the fake site, opens its page and waits for the script to settle. */
async function openFakeSitePage(page: Page, target: FakeSitePage): Promise<void> {
  await page.request.get(
    `${FAKE_SITE_ORIGIN}/__dev/show-capture?page=${target.page}&name=${target.capture}`,
  );
  await page.goto(FAKE_SITE_ORIGIN + target.path);
  await page.waitForTimeout(SETTLE_MS);
  await page.mouse.move(0, 0);
}

/** Every page shows its default capture again. */
async function resetFakeSite(page: Page): Promise<void> {
  await page.request.get(`${FAKE_SITE_ORIGIN}/__dev/reset`);
}

/** The folder of a script's artboards: <script>/design, kept out of git. */
function designFolder(scriptId: string): string {
  return path.join(REPO_ROOT, scriptId, "design");
}

function fileUrl(file: string): string {
  return pathToFileURL(file).href;
}

/** Where the restyle tools write their runs and screenshots, kept out of git. */
const RUNS_FOLDER = path.join(REPO_ROOT, ".restyle-runs");

export {
  FAKE_SITE_ORIGIN,
  RUNS_FOLDER,
  designFolder,
  fileUrl,
  openFakeSitePage,
  resetFakeSite,
  restyleContext,
};
