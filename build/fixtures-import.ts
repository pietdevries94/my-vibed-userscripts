// Usage: npm run fixtures:import <script>
// Moves <script>--<page>.<ext> from the download folder into <script>/fixtures/<page>.<ext>.
// Overwrites files with the same name. There is no fixture history.
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
  .toSorted();
if (captures.length === 0) {
  console.log(`No files starting with ${prefix} in ${downloads}.`);
  process.exit(0);
}

const fixtures = path.join(script.directory, "fixtures");
fs.mkdirSync(fixtures, { recursive: true });
console.log(`Imported into ${script.id}/fixtures/:`);
for (const capture of captures) {
  const fixtureName = capture.slice(prefix.length);
  const target = path.join(fixtures, fixtureName);
  const label = fs.existsSync(target) ? "replaced" : "new     ";
  moveFile(path.join(downloads, capture), target);
  console.log(`  ${label}  ${fixtureName}`);
}
console.log("Skim these files before Claude reads them.");
