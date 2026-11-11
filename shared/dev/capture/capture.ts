// "Capture fixtures": the dev file's Violentmonkey menu command. It scrubs the page and
// the script's GET responses, runs the leak check, and downloads two files:
// <script>--<page>.html and <script>--<page>.json. A failed leak check downloads nothing.
// Dev file only; the release build never includes it.
import { findLeaks, redact } from "../scrub/leak-check.ts";
import type { Leak } from "../scrub/leak-check.ts";
import type { Pseudonyms } from "../scrub/pseudonyms.ts";
import type { ScrubRules } from "../scrub/rules.ts";
import { createPseudonyms } from "../scrub/pseudonyms.ts";
import { logEntries } from "../../runtime/script-log.ts";
import { scrubElement } from "../scrub/scrub-dom.ts";
import { scrubJson } from "../scrub/scrub-json.ts";

type GetOnlyFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What one page of a script captures. */
interface CapturePage {
  /** The `<page>` part of the file names. */
  name: string;
  /** The part of the page to keep. */
  root: Element;
  /**
   * Sends the page's GET requests through `fetch`, which refuses anything else.
   * `data` is scrubbed. `meta` is written as it is, so it may hold only stand-ins
   * from `pseudonyms` and values that identify nothing.
   */
  collect: (
    fetch: GetOnlyFetch,
    pseudonyms: Pseudonyms,
  ) => Promise<{ data: unknown; meta: Record<string, unknown> }>;
}

interface CaptureDefinition {
  scriptId: string;
  rules: ScrubRules;
  /** The page to capture at this location, or null when it is not on the capture list. */
  page: (document: Document, location: Location) => CapturePage | null;
}

interface RecordedError {
  message: string;
  stack: string;
}

const recordedErrors: RecordedError[] = [];

/** Tells the owner, in the page, what the capture did. */
function notifyOwner(message: string): void {
  // oxlint-disable-next-line eslint/no-alert -- the menu command has no other way to reach the owner
  globalThis.alert(message);
}

async function getOnlyFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    throw new TypeError(`Capture sends GET requests only, not ${method}.`);
  }
  return fetch(url, { ...init, method: "GET" });
}

/** Keeps uncaught errors from the script's own code, for the capture's log. */
function recordScriptErrors(scriptId: string): void {
  const isFromScript = (stack: string): boolean =>
    stack.includes(".user.js") || stack.includes(scriptId);
  globalThis.addEventListener("error", (event) => {
    const stack = event.error instanceof Error ? (event.error.stack ?? "") : "";
    if (isFromScript(`${stack} ${event.filename}`)) {
      recordedErrors.push({ message: event.message, stack });
    }
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    if (reason instanceof Error && isFromScript(reason.stack ?? "")) {
      recordedErrors.push({ message: reason.message, stack: reason.stack ?? "" });
    }
  });
}

function download(fileName: string, text: string, type: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function buildFiles(
  definition: CaptureDefinition,
  page: CapturePage,
): Promise<{ html: string; json: string; leaks: Leak[] }> {
  const pseudonyms = createPseudonyms();
  const { data, meta } = await page.collect(getOnlyFetch, pseudonyms);
  const html = scrubElement(page.root, definition.rules, pseudonyms).outerHTML;
  const log = logEntries().map(({ message, data: logData }) => ({
    data: scrubJson(logData, definition.rules, pseudonyms),
    message,
  }));
  const scrubbedData = scrubJson(data, definition.rules, pseudonyms);
  // Errors last, so every replaced value is known when they are redacted.
  const errors = recordedErrors.map(({ message, stack }) => ({
    message: redact(message, pseudonyms),
    stack: redact(stack, pseudonyms),
  }));
  const json = JSON.stringify({ data: scrubbedData, errors, log, meta }, null, 2);
  return { html, json, leaks: findLeaks([html, json], pseudonyms) };
}

/** Downloads `<baseName>.html` and `<baseName>.json`. */
function saveFiles(baseName: string, html: string, json: string): void {
  download(`${baseName}.html`, html, "text/html");
  download(`${baseName}.json`, json, "application/json");
}

async function capture(definition: CaptureDefinition): Promise<void> {
  const page = definition.page(document, location);
  if (page === null) {
    notifyOwner("Capture fixtures: this page is not on the capture list. Nothing was saved.");
    return;
  }
  const { html, json, leaks } = await buildFiles(definition, page);
  if (leaks.length > 0) {
    notifyOwner(
      `Capture fixtures: the leak check refused this capture. Nothing was saved.\n\n${leaks.map(({ field, foundIn }) => `${field}\n  in: ${foundIn}`).join("\n")}`,
    );
    return;
  }
  saveFiles(`${definition.scriptId}--${page.name}`, html, json);
}

/** Adds the "Capture fixtures" menu command. Call it once, from the script's capture.ts. */
function registerCapture(definition: CaptureDefinition): void {
  recordScriptErrors(definition.scriptId);
  GM_registerMenuCommand("Capture fixtures", () => {
    capture(definition).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      notifyOwner(`Capture fixtures failed: ${message}. Nothing was saved.`);
    });
  });
}

export type { CaptureDefinition, CapturePage, GetOnlyFetch };
export { registerCapture };
