import { REPO_ROOT } from "./scripts.ts";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

/** Runs a command in the repo root with inherited output. True when it exits with 0. */
function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): boolean {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  return result.status === 0;
}

/** Runs `npm <args>` in the repo root. True when it exits with 0. */
function runNpm(args: string[]): boolean {
  return run(npm, args);
}

/** The trimmed stdout of a command, or null when it fails. */
function outputOrNull(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

/** The trimmed stdout of a command. Throws when it fails. */
function output(command: string, args: string[]): string {
  const result = outputOrNull(command, args);
  if (result === null) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}

export { output, outputOrNull, run, runNpm };
