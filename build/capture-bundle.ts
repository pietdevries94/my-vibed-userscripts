// Usage: npm run capture:bundle <script>
// Writes .real-site/<script>-capture.js: the script's capture as one async function.
// Claude passes its text to browser_evaluate in the real-site browser, with a
// `filename` in .real-site/, then runs `npm run capture:save`. The function scrubs in
// the page, returns only the scrubbed files and changes nothing on the page.
import { REPO_ROOT, selectScripts } from "./scripts.ts";
import { bundleCapture } from "./bundle.ts";
import fs from "node:fs";
import path from "node:path";

const [name] = process.argv.slice(2);
const [script] = selectScripts(name ?? "");
if (script === undefined) {
  process.exit(1);
}
const directory = path.join(REPO_ROOT, ".real-site");
fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, `${script.id}-capture.js`);
fs.writeFileSync(file, await bundleCapture(script));
console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
