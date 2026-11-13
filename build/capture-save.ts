// Usage: npm run capture:save <script> <result-file>
// Reads what the capture bundle returned in browser_evaluate, saved to <result-file>,
// and writes <script>/fixtures/<page>.html and <page>.json, and <page>.css when captured. In a worktree the files go
// to the main checkout and the worktree gets a symlink, as `fixtures:link` makes.
import { REPO_ROOT, selectScripts } from "./scripts.ts";
import type { CapturedFiles } from "../shared/dev/capture/capture.ts";
import fs from "node:fs";
import { mainCheckout } from "./main-checkout.ts";
import path from "node:path";

function isCapturedFiles(value: unknown): value is CapturedFiles {
  return (
    typeof value === "object" &&
    value !== null &&
    "baseName" in value &&
    "html" in value &&
    "json" in value &&
    typeof value.baseName === "string" &&
    typeof value.html === "string" &&
    typeof value.json === "string"
  );
}

/** The script's fixtures folder in the main checkout, linked into this worktree. */
function prepareFixturesDirectory(id: string): string {
  const directory = path.join(mainCheckout(), id, "fixtures");
  fs.mkdirSync(directory, { recursive: true });
  const local = path.join(REPO_ROOT, id, "fixtures");
  if (path.resolve(local) !== path.resolve(directory) && !fs.existsSync(local)) {
    fs.symlinkSync(directory, local, "dir");
  }
  return directory;
}

const [name, resultFile] = process.argv.slice(2);
const [script] = selectScripts(name ?? "");
if (script === undefined || resultFile === undefined) {
  console.error("Usage: npm run capture:save <script> <result-file>");
  process.exit(1);
}
const result: unknown = JSON.parse(fs.readFileSync(resultFile, "utf8"));
if (result === null) {
  console.error("The capture returned null: the page is not on the capture list.");
  process.exit(1);
}
const prefix = `${script.id}--`;
if (!isCapturedFiles(result) || !result.baseName.startsWith(prefix)) {
  console.error(`${resultFile} is not a ${script.id} capture result.`);
  process.exit(1);
}
const page = result.baseName.slice(prefix.length);
const directory = prepareFixturesDirectory(script.id);
fs.writeFileSync(path.join(directory, `${page}.html`), result.html);
fs.writeFileSync(path.join(directory, `${page}.json`), result.json);
if (typeof result.css === "string") {
  fs.writeFileSync(path.join(directory, `${page}.css`), result.css);
}
fs.rmSync(resultFile);
console.log(
  `Saved ${script.id}/fixtures/${page}.html, .json${typeof result.css === "string" ? " and .css" : ""}`,
);
