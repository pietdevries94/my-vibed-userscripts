// Usage: npm run fixtures:import <script> [name]
// Moves <script>--<page>.<ext> from the download folder into <script>/fixtures/<page>.<ext>,
// or <page>-<name>.<ext> with a name, so a capture keeps the fixture of the same page.
// Overwrites a fixture with the same name. There is no fixture history. A browser
// suffix for a repeated download, such as "board(1).html", is dropped. When two
// downloads would get the same fixture name, nothing is imported.
// The download folder is ~/Downloads, or DOWNLOADS_DIR when set.
// A script with <script>/src/capture/fixture-cleanup.ts cleans each page capture (.html) on the
// way in, such as taking out what the script itself added to the page.
import type { Script } from "./scripts.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { selectScripts } from "./scripts.ts";

/** A script's cleanup of a captured page's HTML. */
type CleanPage = (html: string) => string;

const CLEANUP_MODULE = path.join("src", "capture", "fixture-cleanup.ts");

function moveFile(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
  } catch {
    // Another volume: copy, then remove.
    fs.copyFileSync(from, to);
    fs.rmSync(from);
  }
}

/**
 * `<page>.<ext>` for a downloaded `<script>--<page>.<ext>`, without a browser suffix
 * like "(1)". With a capture name, `<page>-<captureName>.<ext>`.
 */
function fixtureNameOf(capture: string, prefix: string, captureName: string): string {
  const fileName = capture.slice(prefix.length).replace(/\s?\(\d+\)(?=\.[^.]+$)/u, "");
  return captureName === "" ? fileName : fileName.replace(/(?=\.[^.]+$)/u, `-${captureName}`);
}

/** Fixture names that more than one capture in the download folder would get. */
function repeatedFixtureNames(captures: string[], prefix: string, captureName: string): string[] {
  const names = captures.map((capture) => fixtureNameOf(capture, prefix, captureName));
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

/** The script's captures in the download folder, oldest first, so the newest wins. */
function capturesIn(downloads: string, prefix: string): string[] {
  return fs
    .readdirSync(downloads)
    .filter((file) => file.startsWith(prefix))
    .toSorted(
      (left, right) =>
        fs.statSync(path.join(downloads, left)).mtimeMs -
        fs.statSync(path.join(downloads, right)).mtimeMs,
    );
}

/** A capture's text as its fixture: a page capture cleaned, any other file as it is. */
function fixtureTextOf(fileName: string, text: string, cleanPage: CleanPage | null): string {
  return cleanPage !== null && fileName.endsWith(".html") ? cleanPage(text) : text;
}

function isCleanupModule(value: unknown): value is { cleanFixtureHtml: CleanPage } {
  return (
    typeof value === "object" &&
    value !== null &&
    "cleanFixtureHtml" in value &&
    typeof value.cleanFixtureHtml === "function"
  );
}

/** The script's cleanup of page captures, when it has one. */
async function cleanupOf(script: Script): Promise<CleanPage | null> {
  const modulePath = path.join(script.directory, CLEANUP_MODULE);
  if (!fs.existsSync(modulePath)) {
    return null;
  }
  const cleanup: unknown = await import(modulePath);
  if (!isCleanupModule(cleanup)) {
    throw new TypeError(`${modulePath} must export cleanFixtureHtml`);
  }
  return cleanup.cleanFixtureHtml;
}

function moveCapture(
  { downloads, fixtures }: { downloads: string; fixtures: string },
  {
    capture,
    fixtureName,
    cleanPage,
  }: { capture: string; fixtureName: string; cleanPage: CleanPage | null },
): void {
  const source = path.join(downloads, capture);
  const target = path.join(fixtures, fixtureName);
  const label = fs.existsSync(target) ? "replaced" : "new     ";
  if (cleanPage !== null && fixtureName.endsWith(".html")) {
    fs.writeFileSync(
      target,
      fixtureTextOf(fixtureName, fs.readFileSync(source, "utf8"), cleanPage),
    );
    fs.rmSync(source);
  } else {
    moveFile(source, target);
  }
  console.log(`  ${label}  ${fixtureName}`);
}

/** Moves the captures into the script's fixtures, each under its fixture name. */
function moveCaptures(
  folders: { downloads: string; fixtures: string },
  scriptId: string,
  {
    captureName,
    captures,
    cleanPage,
    prefix,
  }: { captureName: string; captures: string[]; cleanPage: CleanPage | null; prefix: string },
): void {
  fs.mkdirSync(folders.fixtures, { recursive: true });
  console.log(`Imported into ${scriptId}/fixtures/:`);
  for (const capture of captures) {
    moveCapture(folders, {
      capture,
      cleanPage,
      fixtureName: fixtureNameOf(capture, prefix, captureName),
    });
  }
  console.log("Skim these files before Claude reads them.");
}

/** Two captures of one page would replace each other, so nothing is imported. */
function stopOnRepeatedNames(downloads: string, repeated: string[]): void {
  if (repeated.length > 0) {
    console.error(
      `More than one capture would become ${repeated.join(", ")}. Nothing was imported.\n` +
        `Import after each capture, or move the extra ones out of ${downloads}.`,
    );
    process.exit(1);
  }
}

async function importCaptures(script: Script, captureName: string): Promise<void> {
  const downloads = process.env.DOWNLOADS_DIR ?? path.join(os.homedir(), "Downloads");
  const prefix = `${script.id}--`;
  const captures = capturesIn(downloads, prefix);
  if (captures.length === 0) {
    console.log(`No files starting with ${prefix} in ${downloads}.`);
    process.exit(0);
  }
  stopOnRepeatedNames(downloads, repeatedFixtureNames(captures, prefix, captureName));
  const folders = { downloads, fixtures: path.join(script.directory, "fixtures") };
  const cleanPage = await cleanupOf(script);
  moveCaptures(folders, script.id, { captureName, captures, cleanPage, prefix });
}

if (import.meta.main) {
  const [scriptName = "", captureName = ""] = process.argv.slice(2);
  const [script] = selectScripts(scriptName);
  if (script === undefined) {
    process.exit(1);
  }
  await importCaptures(script, captureName);
}

export { fixtureNameOf, fixtureTextOf, repeatedFixtureNames };
