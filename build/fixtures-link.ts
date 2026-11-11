// Usage: npm run fixtures:link
// In a worktree, symlinks every script's fixtures from the main checkout.
import { REPO_ROOT, findScriptIds } from "./scripts.ts";
import fs from "node:fs";
import { output } from "./run.ts";
import path from "node:path";

function mainCheckout(): string {
  const worktree = /^worktree (?<directory>.+)$/mu.exec(
    output("git", ["worktree", "list", "--porcelain"]),
  );
  const directory = worktree?.groups?.directory;
  if (directory === undefined) {
    throw new Error("git worktree list gave no main checkout");
  }
  return directory;
}

function linkFixtures(main: string, id: string): string {
  const source = path.join(main, id, "fixtures");
  const link = path.join(REPO_ROOT, id, "fixtures");
  if (!fs.existsSync(source)) {
    return `${id}: the main checkout has no fixtures.`;
  }
  const existing = fs.lstatSync(link, { throwIfNoEntry: false });
  if (existing === undefined) {
    fs.symlinkSync(source, link, "dir");
    return `${id}: linked ${id}/fixtures to ${source}`;
  }
  return existing.isSymbolicLink()
    ? `${id}: already linked.`
    : `${id}: ${id}/fixtures exists and is not a link. Left alone.`;
}

const main = mainCheckout();
if (path.resolve(main) === path.resolve(REPO_ROOT)) {
  console.log("This is the main checkout. Nothing to link.");
} else {
  for (const id of findScriptIds()) {
    console.log(linkFixtures(main, id));
  }
}
