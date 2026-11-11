// Usage: npm run release [script] [patch|minor|major] [-- --notes <file.json>]
//        npm run release:detect
// Without a script name it releases every script whose release build differs from
// its committed dist file, ignoring the @version line, each with a patch bump.
// --notes names a JSON file that maps a script to its release commit body.
// A rerun after a failed push finds the unpushed release commit and only pushes.
import { bumpVersion, isBump } from "./versions.ts";
import { bundleScript, withoutVersion } from "./bundle.ts";
import {
  findScriptIds,
  isRecord,
  readJsonFile,
  readScript,
  releaseFilePath,
  scriptJsonPath,
} from "./scripts.ts";
import { output, outputOrNull, run, runNpm } from "./run.ts";
import type { Bump } from "./versions.ts";
import type { Script } from "./scripts.ts";
import fs from "node:fs";

interface ReleaseRequest {
  bump: Bump;
  name: string | undefined;
  notes: Record<string, string>;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function isChanged(script: Script): Promise<boolean> {
  const file = releaseFilePath(script.id);
  if (!fs.existsSync(file)) {
    return true;
  }
  const built = await bundleScript(script, "release");
  return withoutVersion(fs.readFileSync(file, "utf8")) !== withoutVersion(built);
}

/** Scripts whose release build differs from the committed file, or that have none yet. */
async function detectChangedScripts(): Promise<Script[]> {
  const scripts = findScriptIds().map((id) => readScript(id));
  const changed = await Promise.all(scripts.map(async (script) => isChanged(script)));
  return scripts.filter((_script, index) => changed[index]);
}

function checkRepositoryState(): void {
  const refusals: [isRefused: () => boolean, reason: string][] = [
    [() => output("git", ["branch", "--show-current"]) !== "main", "not on main"],
    [() => output("git", ["status", "--porcelain"]) !== "", "the working tree is not clean"],
    [() => outputOrNull("git", ["remote", "get-url", "origin"]) === null, "no origin remote"],
    [() => !run("git", ["fetch", "origin", "main"]), "git fetch failed"],
    [
      () => output("git", ["rev-list", "--count", "HEAD..origin/main"]) !== "0",
      "main is behind origin/main",
    ],
  ];
  const refusal = refusals.find(([isRefused]) => isRefused());
  if (refusal !== undefined) {
    fail(`Release refused: ${refusal[1]}.`);
  }
}

/** Subjects of release commits not on origin yet. */
function unpushedReleaseSubjects(): string[] {
  return output("git", ["log", "origin/main..HEAD", "--format=%s"])
    .split("\n")
    .filter((subject) => subject.startsWith("release "));
}

function runChecks(scripts: Script[]): void {
  const steps = [
    ["run", "typecheck"],
    ["run", "lint"],
    ["run", "format:check"],
    ["test"],
    ["run", "build"],
    ["run", "check:dist"],
    ...scripts.map((script) => ["run", "test:fixtures", script.id]),
  ];
  const failedStep = steps.find((step) => !runNpm(step));
  if (failedStep !== undefined) {
    fail(`Release stopped: npm ${failedStep.join(" ")} failed.`);
  }
}

function bumpScriptJson(script: Script, bump: Bump): void {
  const config = { ...script.config, version: bumpVersion(script.config.version, bump) };
  fs.writeFileSync(scriptJsonPath(script.id), `${JSON.stringify(config, null, 2)}\n`);
  runNpm(["exec", "--", "oxfmt", scriptJsonPath(script.id)]);
}

function commitRelease(script: Script, body: string): void {
  const message = [`release ${script.id} ${script.config.version}`, body.trim()]
    .filter(Boolean)
    .join("\n\n");
  const isCommitted =
    run("git", ["add", scriptJsonPath(script.id), releaseFilePath(script.id)]) &&
    run("git", ["commit", "-m", message]);
  if (!isCommitted) {
    fail(`Release stopped: the commit for ${script.id} failed.`);
  }
  console.log(`Committed release ${script.id} ${script.config.version}.`);
}

async function releaseScript(script: Script, bump: Bump, body: string): Promise<void> {
  const file = releaseFilePath(script.id);
  // A script's first release keeps the version it started with.
  if (fs.existsSync(file)) {
    bumpScriptJson(script, bump);
  }
  const released = readScript(script.id);
  fs.writeFileSync(file, await bundleScript(released, "release"));
  if (!runNpm(["run", "check:dist"])) {
    fail(`Release stopped: check:dist failed for ${script.id}. Nothing is committed.`);
  }
  commitRelease(released, body);
}

function readNotes(notesFile: string | undefined): Record<string, string> {
  const notes = notesFile === undefined ? {} : readJsonFile(notesFile);
  if (!isRecord(notes) || !Object.values(notes).every((body) => typeof body === "string")) {
    fail("--notes must name a JSON object that maps a script to a string.");
  }
  return Object.fromEntries(Object.entries(notes).map(([id, body]) => [id, String(body)]));
}

function parseArguments(args: string[]): ReleaseRequest {
  const notesIndex = args.indexOf("--notes");
  const positional = args.filter(
    (arg, index) => !arg.startsWith("--") && (notesIndex === -1 || index !== notesIndex + 1),
  );
  const name = positional.find((arg) => !isBump(arg));
  const bump = positional.find((arg) => isBump(arg)) ?? "patch";
  if (name !== undefined && !findScriptIds().includes(name)) {
    fail(`Unknown script "${name}".`);
  }
  if (name === undefined && bump !== "patch") {
    fail("A minor or major bump needs a script name.");
  }
  const notes = readNotes(notesIndex === -1 ? undefined : args[notesIndex + 1]);
  return { bump: isBump(bump) ? bump : "patch", name, notes };
}

async function releaseTargets(request: ReleaseRequest): Promise<Script[]> {
  const alreadyCommitted = unpushedReleaseSubjects();
  const candidates =
    request.name === undefined ? await detectChangedScripts() : [readScript(request.name)];
  return candidates.filter(
    (script) => !alreadyCommitted.includes(`release ${script.id} ${script.config.version}`),
  );
}

async function printDetection(): Promise<void> {
  const changed = await detectChangedScripts();
  const names = changed.map((script) => script.id).join(", ");
  console.log(changed.length === 0 ? "No script would be released." : `Would release: ${names}`);
}

async function releaseAndPush(request: ReleaseRequest, targets: Script[]): Promise<void> {
  runChecks(targets);
  for (const script of targets) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one commit per script, in order
    await releaseScript(script, request.bump, request.notes[script.id] ?? "");
  }
  if (!run("git", ["push", "origin", "main"])) {
    fail("Push failed. Nothing was undone. Run:\n  git pull --rebase\n  git push");
  }
  console.log("Released and pushed.");
}

async function main(args: string[]): Promise<void> {
  if (args.includes("--detect")) {
    await printDetection();
    return;
  }
  const request = parseArguments(args);
  checkRepositoryState();
  const targets = await releaseTargets(request);
  if (targets.length === 0 && unpushedReleaseSubjects().length === 0) {
    console.log("Nothing to release.");
    return;
  }
  await releaseAndPush(request, targets);
}

await main(process.argv.slice(2));
