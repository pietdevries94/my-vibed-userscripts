// Usage: npm test [script]
//        npm run test:fixtures [script]
// The first runs unit tests; fixture tests skip when the script has no fixtures.
// The second runs only fixture tests, and fails when fixtures are missing.
import { REPO_ROOT, selectScripts } from "./scripts.ts";
import fs from "node:fs";
import path from "node:path";
import { run } from "./run.ts";

const FIXTURE_TEST_SUFFIX = ".fixtures.test.ts";

const args = process.argv.slice(2);
const isFixtureRun = args.includes("--fixtures");
const scriptName = args.find((arg) => !arg.startsWith("--"));
const scripts = selectScripts(scriptName);

function testFilesIn(folder: string): string[] {
  return fs
    .globSync(`${folder}/**/*.test.ts`, {
      cwd: REPO_ROOT,
      exclude: (file) => file.includes("node_modules"),
    })
    .toSorted();
}

function fixtureTestFiles(): string[] {
  const missing = scripts.filter(
    (script) => !fs.existsSync(path.join(script.directory, "fixtures")),
  );
  for (const script of missing) {
    console.error(
      `Missing fixtures: ${script.id}/fixtures. Capture them, then run npm run fixtures:import ${script.id}.`,
    );
  }
  if (missing.length > 0) {
    process.exit(1);
  }
  return scripts
    .flatMap((script) => testFilesIn(script.id))
    .filter((file) => file.endsWith(FIXTURE_TEST_SUFFIX));
}

function unitTestFiles(): string[] {
  const sharedFolders = scriptName === undefined ? ["shared", "build"] : [];
  return [...sharedFolders, ...scripts.map((script) => script.id)].flatMap((folder) =>
    testFilesIn(folder),
  );
}

const testFiles = isFixtureRun ? fixtureTestFiles() : unitTestFiles();
if (testFiles.length === 0) {
  console.log("No tests to run.");
  process.exit(0);
}
const isPassed = run(
  process.execPath,
  ["--test", ...testFiles],
  isFixtureRun ? { REQUIRE_FIXTURES: "1" } : {},
);
process.exit(isPassed ? 0 : 1);
