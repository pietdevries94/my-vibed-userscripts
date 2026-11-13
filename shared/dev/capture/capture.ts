// "Capture fixtures": the dev file's Violentmonkey menu command. It scrubs the page and
// the script's GET responses, and downloads <script>--<page>.html and <script>--<page>.json,
// plus <script>--<page>.css for a page that captures its styles.
// "Capture fixtures in 5 seconds" waits first, so the owner can open a dropdown.
// `npm run capture:bundle` packs `captureFiles` for the real-site browser instead.
// Dev only; the release build never includes it.
import type { Pseudonyms } from "../scrub/pseudonyms.ts";
import type { ScrubRules } from "../scrub/rules.ts";
import { createPseudonyms } from "../scrub/pseudonyms.ts";
import { logEntries } from "../../runtime/script-log.ts";
import { matchedCss } from "../scrub/scrub-css.ts";
import { redact } from "../scrub/redact.ts";
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
   * The live element whose CSS to save, for the fake site's styling. `root` is often a
   * detached copy, which ancestor selectors would not match. Leave out to save no CSS.
   */
  styleRoot?: Element;
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

/** The scrubbed files of one capture. `baseName` is `<script>--<page>`. */
interface CapturedFiles {
  baseName: string;
  html: string;
  json: string;
  /** The CSS that applies to the page, when the page captures its styles. */
  css?: string;
}

interface RecordedError {
  message: string;
  stack: string;
}

const recordedErrors: RecordedError[] = [];
const CAPTURE_DELAY_MS = 5000;

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
): Promise<Omit<CapturedFiles, "baseName">> {
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
  return page.styleRoot === undefined
    ? { html, json }
    : { css: matchedCss(page.styleRoot), html, json };
}

/** Downloads `<baseName>.html`, `<baseName>.json` and, when there is CSS, `<baseName>.css`. */
function saveFiles({ baseName, html, json, css }: CapturedFiles): void {
  download(`${baseName}.html`, html, "text/html");
  download(`${baseName}.json`, json, "application/json");
  if (css !== undefined) {
    download(`${baseName}.css`, css, "text/css");
  }
}

/** The scrubbed files of the page at this location, or null when it is not on the capture list. */
async function captureFiles(definition: CaptureDefinition): Promise<CapturedFiles | null> {
  const page = definition.page(document, location);
  if (page === null) {
    return null;
  }
  const files = await buildFiles(definition, page);
  return { baseName: `${definition.scriptId}--${page.name}`, ...files };
}

async function capture(definition: CaptureDefinition): Promise<void> {
  const files = await captureFiles(definition);
  if (files === null) {
    notifyOwner("Capture fixtures: this page is not on the capture list. Nothing was saved.");
    return;
  }
  saveFiles(files);
}

function captureOrReportFailure(definition: CaptureDefinition): void {
  capture(definition).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    notifyOwner(`Capture fixtures failed: ${message}. Nothing was saved.`);
  });
}

/**
 * Adds the "Capture fixtures" menu commands, one now and one after a delay.
 * The dev entry calls it with the script's capture definition.
 */
function registerCapture(definition: CaptureDefinition): void {
  recordScriptErrors(definition.scriptId);
  GM_registerMenuCommand("Capture fixtures", () => {
    captureOrReportFailure(definition);
  });
  GM_registerMenuCommand("Capture fixtures in 5 seconds", () => {
    setTimeout(() => {
      captureOrReportFailure(definition);
    }, CAPTURE_DELAY_MS);
  });
}

export type { CaptureDefinition, CapturedFiles, CapturePage, GetOnlyFetch };
export { captureFiles, registerCapture };
