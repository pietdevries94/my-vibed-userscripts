// Usage: npm run fixtures:import <script> [name]
// Moves <script>--<page>.<ext> from the download folder into <script>/fixtures/<page>.<ext>,
// or <page>-<name>.<ext> with a name, so a capture keeps the fixture of the same page.
// Overwrites files with the same name. There is no fixture history. A browser
// suffix for a repeated download, such as "board(1).html", is dropped; the newest
// download wins.
// The download folder is ~/Downloads, or DOWNLOADS_DIR when set.
import type { Script } from "./scripts.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { selectScripts } from "./scripts.ts";

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

function moveCapture(
  { downloads, fixtures }: { downloads: string; fixtures: string },
  capture: string,
  fixtureName: string,
): void {
  const target = path.join(fixtures, fixtureName);
  const label = fs.existsSync(target) ? "replaced" : "new     ";
  moveFile(path.join(downloads, capture), target);
  console.log(`  ${label}  ${fixtureName}`);
}

/** Moves the captures into the script's fixtures, each under its fixture name. */
function moveCaptures(
  folders: { downloads: string; fixtures: string },
  scriptId: string,
  { captureName, captures, prefix }: { captureName: string; captures: string[]; prefix: string },
): void {
  fs.mkdirSync(folders.fixtures, { recursive: true });
  console.log(`Imported into ${scriptId}/fixtures/:`);
  for (const capture of captures) {
    moveCapture(folders, capture, fixtureNameOf(capture, prefix, captureName));
  }
  console.log("Skim these files before Claude reads them.");
}

function importCaptures(script: Script, captureName: string): void {
  const downloads = process.env.DOWNLOADS_DIR ?? path.join(os.homedir(), "Downloads");
  const prefix = `${script.id}--`;
  const captures = capturesIn(downloads, prefix);
  if (captures.length === 0) {
    console.log(`No files starting with ${prefix} in ${downloads}.`);
    process.exit(0);
  }
  const folders = { downloads, fixtures: path.join(script.directory, "fixtures") };
  moveCaptures(folders, script.id, { captureName, captures, prefix });
}

if (import.meta.main) {
  const [scriptName = "", captureName = ""] = process.argv.slice(2);
  const [script] = selectScripts(scriptName);
  if (script === undefined) {
    process.exit(1);
  }
  importCaptures(script, captureName);
}

export { fixtureNameOf };
