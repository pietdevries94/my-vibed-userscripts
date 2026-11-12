import { output } from "./run.ts";

/** The directory of the main checkout. Equals the repo root outside a worktree. */
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

export { mainCheckout };
