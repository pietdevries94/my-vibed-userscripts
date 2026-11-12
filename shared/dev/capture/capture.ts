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

function panelButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  button.style.cssText = "margin: 8px 8px 0 0; padding: 4px 12px; font: inherit;";
  button.addEventListener("click", onClick);
  return button;
}

function reportText(report: string): HTMLTextAreaElement {
  const text = document.createElement("textarea");
  text.readOnly = true;
  text.value = report;
  text.style.cssText = "flex: 1; margin-top: 8px; font: 12px monospace; white-space: pre;";
  return text;
}

/**
 * Shows a long report in a box on the page, with a Copy button. An alert cuts long
 * text off. When the clipboard is blocked, the text stays selected for Cmd+C.
 */
function showReport(title: string, report: string): void {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position: fixed; inset: 5vh 5vw; z-index: 2147483647; display: flex; flex-direction: column; padding: 16px; background: #fff; color: #000; border: 2px solid #c00; font: 14px sans-serif; box-shadow: 0 4px 24px #0006;";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = reportText(report);
  const copy = panelButton("Copy", () => {
    text.select();
    navigator.clipboard.writeText(report).catch(() => {
      // Blocked. The text is selected; the owner copies it by hand.
    });
  });
  const close = panelButton("Close", () => {
    panel.remove();
  });
  panel.append(heading, text, copy, close);
  document.body.append(panel);
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
  return { html, json, leaks: findLeaks([html, json], pseudonyms, definition.rules) };
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
    showReport(
      "Capture fixtures: the leak check refused this capture. Nothing was saved.",
      leaks.map(({ field, foundIn }) => `${field}\n  in: ${foundIn}`).join("\n"),
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
