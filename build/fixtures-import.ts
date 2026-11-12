// Usage: npm run fixtures:import <script>
// Moves <script>--<page>.<ext> from the download folder into <script>/fixtures/<page>.<ext>.
// Overwrites files with the same name. There is no fixture history. A browser
// suffix for a repeated download, such as "board(1).html", is dropped; the newest
// download wins.
// The download folder is ~/Downloads, or DOWNLOADS_DIR when set.
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

/** `<page>.<ext>` for a downloaded `<script>--<page>.<ext>`, without a browser suffix like "(1)". */
function fixtureNameOf(capture: string, prefix: string): string {
  return capture.slice(prefix.length).replace(/\s?\(\d+\)(?=\.[^.]+$)/u, "");
}

const [name] = process.argv.slice(2);
const [script] = selectScripts(name ?? "");
if (script === undefined) {
  process.exit(1);
}
const downloads = process.env.DOWNLOADS_DIR ?? path.join(os.homedir(), "Downloads");
const prefix = `${script.id}--`;
const captures = fs
  .readdirSync(downloads)
  .filter((file) => file.startsWith(prefix))
  .toSorted(
    (left, right) =>
      fs.statSync(path.join(downloads, left)).mtimeMs -
      fs.statSync(path.join(downloads, right)).mtimeMs,
  );
if (captures.length === 0) {
  console.log(`No files starting with ${prefix} in ${downloads}.`);
  process.exit(0);
}

const fixtures = path.join(script.directory, "fixtures");
fs.mkdirSync(fixtures, { recursive: true });
console.log(`Imported into ${script.id}/fixtures/:`);
for (const capture of captures) {
  const fixtureName = fixtureNameOf(capture, prefix);
  const target = path.join(fixtures, fixtureName);
  const label = fs.existsSync(target) ? "replaced" : "new     ";
  moveFile(path.join(downloads, capture), target);
  console.log(`  ${label}  ${fixtureName}`);
}
console.log("Skim these files before Claude reads them.");
