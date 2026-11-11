// Usage: npm run precommit
// Run before every commit. It is not a git hook. Formats, then runs every check.
// Fixture tests run for each script that has fixtures. A script without them is
// named here; the release command still requires them.
import { REPO_ROOT, findScriptIds } from "./scripts.ts";
import fs from "node:fs";
import path from "node:path";
import { runNpm } from "./run.ts";
import { stagedFixturePaths } from "./fixture-paths.ts";

const steps: [label: string, args: string[]][] = [
  ["format", ["run", "format"]],
  ["typecheck", ["run", "typecheck"]],
  ["lint", ["run", "lint"]],
  ["format check", ["run", "format:check"]],
  ["unit tests", ["test"]],
  ["build", ["run", "build"]],
  ["check:dist", ["run", "check:dist"]],
];
for (const id of findScriptIds()) {
  if (fs.existsSync(path.join(REPO_ROOT, id, "fixtures"))) {
    steps.push([`fixture tests ${id}`, ["run", "test:fixtures", id]]);
  } else {
    console.log(`precommit: ${id} has no fixtures, so its fixture tests do not run.`);
  }
}

const failed = steps
  .filter(([label, args]) => {
    console.log(`\n== ${label}`);
    return !runNpm(args);
  })
  .map(([label]) => label);
const staged = stagedFixturePaths();
for (const file of staged) {
  console.error(`Staged fixture: ${file}. Unstage it: fixtures are never committed.`);
}
if (staged.length > 0) {
  failed.push("staged fixtures");
}

if (failed.length > 0) {
  console.error(`\nprecommit failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("\nprecommit: all checks passed.");
