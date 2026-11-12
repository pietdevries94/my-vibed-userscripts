// The `fake-site` MCP entry. Starts Playwright MCP for a script's fake site: only
// localhost:8786 (the dev file) and localhost:8787 (the fake site) can load, and every
// fake-site page gets the dev file with the GM shim. Clicking and typing are allowed.
// Run `npm run dev <script>` first; it serves both.
// With several fake sites, FAKE_SITE_SCRIPT names the script.
// It speaks MCP on stdout, so every message here goes to stderr.
import { DEV_SERVER_PORT, FAKE_SITE_PORT, hasFakeSite } from "../../../build/bundle.ts";
import { REPO_ROOT, findScriptIds, readScript } from "../../../build/scripts.ts";
import type { Script } from "../../../build/scripts.ts";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { userscriptLoaderScript } from "./userscript-loader.ts";

const PLAYWRIGHT_MCP_CLI = path.join(REPO_ROOT, "node_modules", "@playwright", "mcp", "cli.js");
const OUTPUT_DIRECTORY = path.join(REPO_ROOT, ".fake-site");

function refuse(message: string): never {
  console.error(`fake-site: ${message}`);
  process.exit(1);
}

function chosenScript(): Script {
  const scripts = findScriptIds()
    .map((id) => readScript(id))
    .filter((script) => hasFakeSite(script));
  const requested = process.env.FAKE_SITE_SCRIPT;
  const chosen =
    requested === undefined && scripts.length === 1
      ? scripts[0]
      : scripts.find((script) => script.id === requested);
  if (chosen === undefined) {
    refuse(
      `set FAKE_SITE_SCRIPT to a script with a fake site: ${scripts.map((script) => script.id).join(", ")}`,
    );
  }
  return chosen;
}

function writeInitScript(script: Script): string {
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const file = path.join(OUTPUT_DIRECTORY, "userscript-loader.js");
  const devFileUrl = `http://localhost:${DEV_SERVER_PORT}/${script.id}.user.js`;
  fs.writeFileSync(file, userscriptLoaderScript(devFileUrl, `http://localhost:${FAKE_SITE_PORT}`));
  return file;
}

const script = chosenScript();
const args = [
  ["--isolated"],
  ["--output-dir", OUTPUT_DIRECTORY],
  ["--init-script", writeInitScript(script)],
  ["--block-service-workers"],
  ["--allowed-origins", `http://localhost:${DEV_SERVER_PORT};http://localhost:${FAKE_SITE_PORT}`],
].flat();
const browser = spawn(process.execPath, [PLAYWRIGHT_MCP_CLI, ...args], { stdio: "inherit" });
browser.on("exit", (code) => {
  process.exit(code ?? 1);
});
