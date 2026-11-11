// Usage: npm run check:dist [-- --base <rev>]
// For each dist/<script>.user.js changed since the base: the version went up, it
// equals script.json, and a fresh release build gives exactly the committed file.
// Base: --base, else CHECK_DIST_BASE, else the merge base with origin/main, else the empty tree.
// A first release has no earlier version, so only the last two checks apply.
import { compareVersions, versionOf } from "./versions.ts";
import { findScriptIds, readScript, releaseFilePath } from "./scripts.ts";
import type { Script } from "./scripts.ts";
import { bundleScript } from "./bundle.ts";
import fs from "node:fs";
import { outputOrNull } from "./run.ts";
import path from "node:path";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const RELEASE_FILES = ":(glob)dist/*.user.js";

function isCommit(rev: string | undefined): rev is string {
  if (rev === undefined || rev === "" || /^0+$/u.test(rev)) {
    return false;
  }
  return outputOrNull("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]) !== null;
}

function resolveBase(requested: string | undefined): string {
  if (isCommit(requested)) {
    return requested;
  }
  if (isCommit("origin/main")) {
    return outputOrNull("git", ["merge-base", "HEAD", "origin/main"]) ?? EMPTY_TREE;
  }
  return EMPTY_TREE;
}

function changedReleaseFiles(base: string): string[] {
  const changed = outputOrNull("git", ["diff", "--name-only", base, "--", RELEASE_FILES]) ?? "";
  const untracked =
    outputOrNull("git", ["ls-files", "--others", "--exclude-standard", "--", RELEASE_FILES]) ?? "";
  return [
    ...new Set([...changed.split("\n"), ...untracked.split("\n")].filter(Boolean)),
  ].toSorted();
}

interface ReleaseFile {
  file: string;
  script: Script;
  committed: string;
}

function previousVersionOf(file: string, base: string): string | null {
  const previous = outputOrNull("git", ["show", `${base}:${file}`]);
  return previous === null ? null : versionOf(previous);
}

function versionProblems({ file, script, committed }: ReleaseFile, base: string): string[] {
  const version = versionOf(committed);
  if (version === null) {
    return [`${file}: no @version`];
  }
  const previousVersion = previousVersionOf(file, base);
  const problems: string[] = [];
  if (previousVersion !== null && compareVersions(version, previousVersion) <= 0) {
    problems.push(`${file}: @version ${version} is not higher than ${previousVersion}`);
  }
  if (version !== script.config.version) {
    problems.push(
      `${file}: @version ${version} differs from ${script.id}/script.json version ${script.config.version}`,
    );
  }
  return problems;
}

async function buildProblems({ file, script, committed }: ReleaseFile): Promise<string[]> {
  const built = await bundleScript(script, "release");
  return built === committed
    ? []
    : [`${file}: a fresh release build differs from the committed file`];
}

async function problemsOf(file: string, base: string): Promise<string[]> {
  const id = path.basename(file, ".user.js");
  if (!fs.existsSync(releaseFilePath(id))) {
    console.log(`${file}: removed`);
    return [];
  }
  if (!findScriptIds().includes(id)) {
    return [`${file}: no script folder ${id}/ with a script.json`];
  }
  const releaseFile = {
    committed: fs.readFileSync(releaseFilePath(id), "utf8"),
    file,
    script: readScript(id),
  };
  return [...versionProblems(releaseFile, base), ...(await buildProblems(releaseFile))];
}

const baseIndex = process.argv.indexOf("--base");
const base = resolveBase(
  baseIndex === -1 ? process.env.CHECK_DIST_BASE : process.argv[baseIndex + 1],
);
const files = changedReleaseFiles(base);
const problemLists = await Promise.all(files.map(async (file) => problemsOf(file, base)));
const problems = problemLists.flat();

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
console.log(
  files.length === 0
    ? "check:dist: no release files changed."
    : `check:dist: ${files.join(", ")} OK.`,
);
