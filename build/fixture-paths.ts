// Finds paths with a `fixtures` segment. Uses Node built-ins only, so the GitHub
// `fixtures` job can run it without npm ci.
// Usage: node build/fixture-paths.ts --staged
//        node build/fixture-paths.ts --range <from> <to>   (from may be empty or all zeros)
import { outputOrNull } from "./run.ts";

const USAGE_ERROR = 2;

function isFixturePath(file: string): boolean {
  return file.split("/").includes("fixtures");
}

function isCommit(rev: string): boolean {
  if (rev === "" || /^0+$/u.test(rev)) {
    return false;
  }
  return outputOrNull("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]) !== null;
}

function lines(text: string | null): string[] {
  return (text ?? "").split("\n").filter(Boolean);
}

/** The commits in from..to. Without a usable `from`: the commits not on origin. */
function commitsInRange(from: string, to: string): string[] {
  const args = isCommit(from) ? [`${from}..${to}`] : [to, "--not", "--remotes=origin"];
  return lines(outputOrNull("git", ["rev-list", ...args]));
}

function fixturePathsInCommits(commits: string[]): { commit: string; file: string }[] {
  return commits.flatMap((commit) =>
    lines(
      outputOrNull("git", [
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        "-m",
        "--root",
        commit,
      ]),
    )
      .filter((file) => isFixturePath(file))
      .map((file) => ({ commit, file })),
  );
}

function stagedFixturePaths(): string[] {
  return lines(outputOrNull("git", ["diff", "--cached", "--name-only"])).filter((file) =>
    isFixturePath(file),
  );
}

function reportStaged(): number {
  const files = stagedFixturePaths();
  for (const file of files) {
    console.error(`Staged fixture: ${file}`);
  }
  return files.length > 0 ? 1 : 0;
}

function reportRange(from: string, to: string): number {
  const hits = fixturePathsInCommits(commitsInRange(from, to));
  for (const { commit, file } of hits) {
    console.error(`Fixture in commit ${commit}: ${file}`);
  }
  return hits.length > 0 ? 1 : 0;
}

function main(): number {
  const [mode, from = "", to = "HEAD"] = process.argv.slice(2);
  if (mode === "--staged") {
    return reportStaged();
  }
  if (mode === "--range") {
    return reportRange(from, to);
  }
  console.error("Usage: node build/fixture-paths.ts --staged | --range <from> <to>");
  return USAGE_ERROR;
}

if (import.meta.main) {
  process.exit(main());
}

export { isFixturePath, stagedFixturePaths };
