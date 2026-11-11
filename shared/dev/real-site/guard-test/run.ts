// Usage: npm run test:guard
// Drives the real Playwright MCP server, headed, against a local site, with the same
// guard files and arguments the `real-site` entry uses. Every case tries to write;
// the site's request log is the result. It also checks the deny rules in
// .claude/settings.json. Local only. A pass is recorded, and the `real-site` entry
// refuses to start without one. With --control it runs the same steps without the
// guard, to show that the writes do reach the site; that run records nothing.
import { EXEMPT_URL, SITE, startSite } from "./site.ts";
import { GUARDED_STEPS, LEFTOVER_WORKER_SETUP, LEFTOVER_WORKER_STEPS } from "./cases.ts";
import {
  GUARD_CONFIG_ENV,
  PLAYWRIGHT_MCP_CLI,
  guardedBrowserArguments,
  recordPassedGuardTest,
  writeInitScript,
} from "../guard.ts";
import { REPO_ROOT, isRecord, readJsonFile } from "../../../../build/scripts.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { GuardConfig } from "../guard.ts";
import type { Hit } from "./site.ts";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Step } from "./cases.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface Session {
  profile: string;
  isGuarded: boolean;
  workDirectory: string;
}

interface Browser {
  run: (step: Step) => Promise<string>;
  close: () => Promise<void>;
}

const SETTLE_MS = 1000;
const CODE_SNIPPET_LENGTH = 80;
const RESULT_SNIPPET_LENGTH = 200;
const ALLOWED_TOOLS = [
  "browser_navigate",
  "browser_navigate_back",
  "browser_snapshot",
  "browser_take_screenshot",
  "browser_network_requests",
  "browser_network_request",
  "browser_console_messages",
  "browser_evaluate",
  "browser_tabs",
  "browser_wait_for",
  "browser_resize",
];
const DENIED_TOOLS = [
  "browser_click",
  "browser_type",
  "browser_fill_form",
  "browser_select_option",
  "browser_press_key",
  "browser_hover",
  "browser_drag",
  "browser_drop",
  "browser_file_upload",
  "browser_handle_dialog",
  "browser_run_code_unsafe",
];
const GUARD_CONFIG: GuardConfig = { postExemptions: [{ url: EXEMPT_URL }], signInOrigins: [] };
const failures: string[] = [];

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function expect(isTrue: boolean, failure: string): void {
  if (!isTrue) {
    failures.push(failure);
  }
}

function browserArguments(profile: string, isGuarded: boolean, workDirectory: string): string[] {
  const outputDirectory = path.join(workDirectory, "output");
  if (!isGuarded) {
    return ["--user-data-dir", profile, "--output-dir", outputDirectory];
  }
  return guardedBrowserArguments({
    allowedOrigins: [SITE],
    initScriptFile: writeInitScript(GUARD_CONFIG, workDirectory),
    outputDirectory,
    profileDirectory: profile,
  });
}

function textOf(result: unknown): string {
  const content =
    isRecord(result) && Array.isArray(result.content) ? (result.content as unknown[]) : [];
  const [first] = content;
  return isRecord(first) && typeof first.text === "string"
    ? first.text.replaceAll(/\s+/gu, " ")
    : "";
}

function toolCall(step: Step): { name: string; arguments: Record<string, unknown> } {
  if (step.kind === "navigate") {
    return { arguments: { url: step.url }, name: "browser_navigate" };
  }
  if (step.kind === "tabs") {
    return { arguments: step.args, name: "browser_tabs" };
  }
  return {
    arguments: { function: step.kind === "evaluate" ? step.code : "() => 0" },
    name: "browser_evaluate",
  };
}

async function openBrowser(
  profile: string,
  isGuarded: boolean,
  workDirectory: string,
): Promise<Browser> {
  const client = new Client({ name: "guard-test", version: "1" });
  const env = { ...process.env, [GUARD_CONFIG_ENV]: JSON.stringify(GUARD_CONFIG) };
  const args = [PLAYWRIGHT_MCP_CLI, ...browserArguments(profile, isGuarded, workDirectory)];
  await client.connect(new StdioClientTransport({ args, command: process.execPath, env }));
  const runStep = async (step: Step): Promise<string> => {
    if (step.kind === "wait") {
      await wait(SETTLE_MS);
      return "";
    }
    const text = textOf(await client.callTool(toolCall(step)));
    if (step.kind === "evaluate" && step.mustContain !== undefined) {
      expect(
        text.includes(step.mustContain),
        `expected "${step.mustContain}" from ${step.code.slice(0, CODE_SNIPPET_LENGTH)}: ${text.slice(0, RESULT_SNIPPET_LENGTH)}`,
      );
    }
    return text;
  };
  return { close: async () => client.close(), run: runStep };
}

async function runSteps(browser: Browser, steps: Step[]): Promise<void> {
  for (const step of steps) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- browser steps run in order
    await browser.run(step);
  }
}

async function runSession(session: Session, steps: Step[]): Promise<void> {
  const browser = await openBrowser(session.profile, session.isGuarded, session.workDirectory);
  try {
    await runSteps(browser, steps);
  } finally {
    await browser.close();
  }
  await wait(SETTLE_MS);
}

function describe(hits: Hit[]): string {
  return hits.map((hit) => `${hit.method} :${hit.port}${hit.url}`).join(", ");
}

function writesIn(hits: Hit[]): Hit[] {
  return hits.filter(
    (hit) => hit.method !== "GET" && hit.method !== "HEAD" && !hit.url.startsWith("/exempt"),
  );
}

function checkGuardedHits(hits: Hit[]): void {
  const writes = writesIn(hits);
  expect(writes.length === 0, `writes got through: ${describe(writes)}`);
  expect(!hits.some((hit) => hit.method === "WS-UPGRADE"), "a WebSocket reached the server");
  expect(!hits.some((hit) => hit.url.startsWith("/sw.js")), "a service worker script was fetched");
  expect(
    !hits.some((hit) => hit.url.includes("case=other-origin-get")),
    "a GET to an origin off the allowlist got through",
  );
  expect(
    hits.some((hit) => hit.method === "POST" && hit.url.startsWith("/exempt")),
    "the exempted POST did not arrive",
  );
  const isRedirectThrough = hits.some((hit) => hit.url.includes("case=redirect-to-other-origin"));
  console.log(
    `Known gap, GET redirect to an origin off the allowlist: ${isRedirectThrough ? "got through" : "blocked"}.`,
  );
}

function checkDenyRules(): void {
  const settings = readJsonFile(path.join(REPO_ROOT, ".claude", "settings.json"));
  const permissions =
    isRecord(settings) && isRecord(settings.permissions) ? settings.permissions : {};
  const deny = Array.isArray(permissions.deny) ? permissions.deny : [];
  const isDenied = (tool: string): boolean => deny.includes(`mcp__real-site__${tool}`);
  for (const tool of DENIED_TOOLS) {
    expect(isDenied(tool), `.claude/settings.json must deny mcp__real-site__${tool}`);
  }
  for (const tool of ALLOWED_TOOLS) {
    expect(!isDenied(tool), `.claude/settings.json must not deny mcp__real-site__${tool}`);
  }
  expect(!deny.includes("mcp__real-site__*"), "the whole real-site server must not be denied");
}

async function checkLeftoverServiceWorker(workDirectory: string, hits: Hit[]): Promise<void> {
  const profile = path.join(workDirectory, "leftover-profile");
  await runSession({ isGuarded: false, profile, workDirectory }, LEFTOVER_WORKER_SETUP);
  hits.length = 0;
  await runSession({ isGuarded: true, profile, workDirectory }, LEFTOVER_WORKER_STEPS);
  expect(
    writesIn(hits).length === 0,
    `the leftover service worker sent: ${describe(writesIn(hits))}`,
  );
}

async function main(): Promise<void> {
  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "guard-test-"));
  const site = startSite();
  try {
    checkDenyRules();
    await runSession(
      { isGuarded: true, profile: path.join(workDirectory, "profile"), workDirectory },
      GUARDED_STEPS,
    );
    checkGuardedHits([...site.hits]);
    await checkLeftoverServiceWorker(workDirectory, site.hits);
  } finally {
    site.close();
    fs.rmSync(workDirectory, { force: true, recursive: true });
  }
}

async function control(): Promise<void> {
  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "guard-control-"));
  const site = startSite();
  try {
    await runSession(
      { isGuarded: false, profile: path.join(workDirectory, "profile"), workDirectory },
      GUARDED_STEPS,
    );
  } finally {
    site.close();
    fs.rmSync(workDirectory, { force: true, recursive: true });
  }
  const writes = writesIn(site.hits);
  console.log(
    `Control run without the guard: ${writes.length} writes reached the site.\n${describe(writes)}`,
  );
  process.exit(writes.length > 0 ? 0 : 1);
}

if (process.argv.includes("--control")) {
  await control();
}
await main();
if (failures.length > 0) {
  console.error(
    `test:guard FAILED. Real-site use stays blocked until it passes.\n- ${failures.join("\n- ")}`,
  );
  process.exit(1);
}
recordPassedGuardTest();
console.log("test:guard passed. Recorded for the real-site entry.");
