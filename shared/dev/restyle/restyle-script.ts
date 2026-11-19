// Reads a script's restyle config and turns its artboards into pages to diff. Dev file only.
import { RUNS_FOLDER, designFolder } from "./restyle-browser.ts";
import { REPO_ROOT } from "../../../build/scripts.ts";
import type { RestyleConfig } from "./restyle-config.ts";
import { artboardHtml } from "./artboard-html.ts";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function isRestyleConfig(value: unknown): value is RestyleConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "states" in value &&
    Array.isArray(value.states) &&
    "checks" in value &&
    Array.isArray(value.checks)
  );
}

/** The config <script>/restyle/states.ts exports as its default. */
async function restyleConfig(scriptId: string): Promise<RestyleConfig> {
  const file = path.join(REPO_ROOT, scriptId, "restyle", "states.ts");
  if (!fs.existsSync(file)) {
    throw new Error(`${scriptId} has no restyle: ${file} is missing`);
  }
  const loaded: unknown = await import(pathToFileURL(file).href);
  const config =
    typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : null;
  if (!isRestyleConfig(config)) {
    throw new TypeError(`${file} has no default export with states and checks`);
  }
  return config;
}

/** Writes each artboard as a plain page under .restyle-runs/design, and returns that folder. */
function writeArtboardPages(scriptId: string, artboards: string[]): string {
  const out = path.join(RUNS_FOLDER, "design", scriptId);
  fs.mkdirSync(out, { recursive: true });
  for (const name of new Set(artboards)) {
    const source = path.join(designFolder(scriptId), `${name}.dc.html`);
    if (!fs.existsSync(source)) {
      throw new Error(`artboard ${name} is missing: download it from the canvas to ${source}`);
    }
    fs.writeFileSync(path.join(out, `${name}.html`), artboardHtml(fs.readFileSync(source, "utf8")));
  }
  return out;
}

/** A run's file name part: its start time, such as 20261119-112407. */
function runStamp(date = new Date()): string {
  return date
    .toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace("T", "-")
    .slice(0, "yyyymmdd-hhmmss".length);
}

export { restyleConfig, runStamp, writeArtboardPages };
