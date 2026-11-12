// Usage: npm run fixtures:link
// In a worktree, symlinks every script's fixtures from the main checkout.
import { REPO_ROOT, findScriptIds } from "./scripts.ts";
import fs from "node:fs";
import { mainCheckout } from "./main-checkout.ts";
import path from "node:path";

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
