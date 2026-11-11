// Usage: npm run build [script]
// Writes dev files to dist/dev/. Never touches release files.
import { devFilePath, selectScripts } from "./scripts.ts";
import { bundleScript } from "./bundle.ts";
import fs from "node:fs";
import path from "node:path";

const scripts = selectScripts(process.argv[2]);
const builds = scripts.map(async (script) => {
  const file = devFilePath(script.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await bundleScript(script, "dev"));
  console.log(`Built dist/dev/${script.id}.user.js`);
});
await Promise.all(builds);
if (scripts.length === 0) {
  console.log("No scripts to build.");
}
