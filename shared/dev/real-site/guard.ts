// The read-only guard's configuration: the allowlist from the open scripts, the
// Playwright MCP arguments, and the record of the last passed `npm run test:guard`.
import type { PostExemption, Script } from "../../../build/scripts.ts";
import {
  REPO_ROOT,
  findScriptIds,
  isRecord,
  readJsonFile,
  readScript,
} from "../../../build/scripts.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";

/** What the init page and the init script need to know. */
interface GuardConfig {
  signInOrigins: string[];
  postExemptions: PostExemption[];
}

interface GuardedBrowserOptions {
  allowedOrigins: string[];
  initScriptFile: string;
  outputDirectory: string;
  profileDirectory: string;
}

const CACHE_DIRECTORY = path.join(os.homedir(), ".cache", "my-vibed-userscripts");
const PLAYWRIGHT_MCP_CLI = path.join(REPO_ROOT, "node_modules", "@playwright", "mcp", "cli.js");
const REAL_SITE_OUTPUT_DIRECTORY = path.join(REPO_ROOT, ".real-site");
const GUARD_CONFIG_ENV = "READ_ONLY_GUARD_CONFIG";
const INIT_PAGE_FILE = path.join(import.meta.dirname, "read-only.init-page.ts");
const INIT_SCRIPT_SOURCE_FILE = path.join(import.meta.dirname, "read-only.init-script.ts");
const GUARD_TEST_RECORD_FILE = path.join(CACHE_DIRECTORY, "guard-test-passed.json");
const MATCH_ORIGIN = /^(?<scheme>https?):\/\/(?<host>[^/]+)\//u;

function openScripts(): Script[] {
  return findScriptIds()
    .map((id) => readScript(id))
    .filter((script) => script.config.mode === "open");
}

/** The origin of a `@match` pattern, or null when its host has a wildcard. */
function originOfMatch(pattern: string): string | null {
  const groups = MATCH_ORIGIN.exec(pattern)?.groups;
  if (groups?.host === undefined || groups.scheme === undefined || groups.host.includes("*")) {
    return null;
  }
  return `${groups.scheme}://${groups.host}`;
}

/** Site, sign-in and CDN origins of the given scripts. Wildcard hosts are left out. */
function allowedOrigins(scripts: Script[]): string[] {
  const origins = scripts.flatMap((script) => [
    ...script.config.match
      .map((pattern) => originOfMatch(pattern))
      .filter((origin) => origin !== null),
    ...(script.config.signInOrigins ?? []),
    ...(script.config.cdnOrigins ?? []),
  ]);
  return [...new Set(origins)];
}

function guardConfig(scripts: Script[]): GuardConfig {
  return {
    postExemptions: scripts.flatMap((script) => script.config.postExemptions ?? []),
    signInOrigins: [...new Set(scripts.flatMap((script) => script.config.signInOrigins ?? []))],
  };
}

/** Writes the init script as JavaScript, with the configuration in front, and returns its path. */
function writeInitScript(config: GuardConfig, directory: string): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "read-only.init-script.js");
  const script = stripTypeScriptTypes(fs.readFileSync(INIT_SCRIPT_SOURCE_FILE, "utf8"));
  fs.writeFileSync(file, `var READ_ONLY_GUARD_CONFIG = ${JSON.stringify(config)};\n${script}`);
  return file;
}

/** The Playwright MCP arguments for a guarded, headed browser. */
function guardedBrowserArguments(options: GuardedBrowserOptions): string[] {
  return [
    ["--user-data-dir", options.profileDirectory],
    ["--output-dir", options.outputDirectory],
    ["--init-page", INIT_PAGE_FILE],
    ["--init-script", options.initScriptFile],
    ["--block-service-workers"],
    ["--allowed-origins", options.allowedOrigins.join(";")],
  ].flat();
}

/** Changes when a guard file or the Playwright MCP version changes. */
function guardFingerprint(): string {
  const hash = createHash("sha256");
  const mcpPackage = path.join(REPO_ROOT, "node_modules", "@playwright", "mcp", "package.json");
  for (const file of [INIT_PAGE_FILE, INIT_SCRIPT_SOURCE_FILE, import.meta.filename, mcpPackage]) {
    hash.update(fs.existsSync(file) ? fs.readFileSync(file) : "");
  }
  return hash.digest("hex");
}

function recordPassedGuardTest(): void {
  fs.mkdirSync(CACHE_DIRECTORY, { recursive: true });
  const record = { fingerprint: guardFingerprint(), passedAt: new Date().toISOString() };
  fs.writeFileSync(GUARD_TEST_RECORD_FILE, JSON.stringify(record));
}

/** True when `npm run test:guard` passed on the current guard files and Playwright MCP version. */
function hasPassedGuardTest(): boolean {
  if (!fs.existsSync(GUARD_TEST_RECORD_FILE)) {
    return false;
  }
  const record = readJsonFile(GUARD_TEST_RECORD_FILE);
  return isRecord(record) && record.fingerprint === guardFingerprint();
}

export type { GuardConfig, GuardedBrowserOptions };
export {
  CACHE_DIRECTORY,
  GUARD_CONFIG_ENV,
  PLAYWRIGHT_MCP_CLI,
  REAL_SITE_OUTPUT_DIRECTORY,
  allowedOrigins,
  guardConfig,
  guardedBrowserArguments,
  hasPassedGuardTest,
  openScripts,
  originOfMatch,
  recordPassedGuardTest,
  writeInitScript,
};
