// The `real-site` MCP entry. Starts Playwright MCP with the read-only guard for an open script.
// Refuses when no script is open, or when `npm run test:guard` has not passed on the current guard.
// With several open scripts, REAL_SITE_SCRIPT names the one whose browser profile to use.
// It speaks MCP on stdout, so every message here goes to stderr.
import {
  CACHE_DIRECTORY,
  GUARD_CONFIG_ENV,
  PLAYWRIGHT_MCP_CLI,
  REAL_SITE_OUTPUT_DIRECTORY,
  allowedOrigins,
  guardConfig,
  guardedBrowserArguments,
  hasPassedGuardTest,
  openScripts,
  writeInitScript,
} from "./guard.ts";
import type { Script } from "../../../build/scripts.ts";
import path from "node:path";
import { spawn } from "node:child_process";

function refuse(message: string): never {
  console.error(`real-site: ${message}`);
  process.exit(1);
}

function profileScript(scripts: Script[]): Script {
  const requested = process.env.REAL_SITE_SCRIPT;
  const chosen =
    requested === undefined && scripts.length === 1
      ? scripts[0]
      : scripts.find((script) => script.id === requested);
  if (chosen === undefined) {
    refuse(
      `set REAL_SITE_SCRIPT to one of the open scripts: ${scripts.map((script) => script.id).join(", ")}`,
    );
  }
  return chosen;
}

const scripts = openScripts();
if (scripts.length === 0) {
  refuse("no script is open. Sealed sites are never opened.");
}
if (!hasPassedGuardTest()) {
  refuse("npm run test:guard has not passed on the current guard. Run it first.");
}
const config = guardConfig(scripts);
const args = guardedBrowserArguments({
  allowedOrigins: allowedOrigins(scripts),
  initScriptFile: writeInitScript(config, path.join(CACHE_DIRECTORY, "real-site")),
  outputDirectory: REAL_SITE_OUTPUT_DIRECTORY,
  profileDirectory: path.join(CACHE_DIRECTORY, profileScript(scripts).id, "profile"),
});
const browser = spawn(process.execPath, [PLAYWRIGHT_MCP_CLI, ...args], {
  env: { ...process.env, [GUARD_CONFIG_ENV]: JSON.stringify(config) },
  stdio: "inherit",
});
browser.on("exit", (code) => {
  process.exit(code ?? 1);
});
