import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

type ScriptMode = "open" | "sealed";

/** Violentmonkey's `@run-at` values. */
const RUN_AT_VALUES = ["document-start", "document-body", "document-end", "document-idle"] as const;
type RunAt = (typeof RUN_AT_VALUES)[number];

/** A narrow exception to the read-only guard, approved by the owner. Matches one exact URL, query ignored. */
interface PostExemption {
  url: string;
}

/** The contents of `<script>/script.json`. */
interface ScriptConfig {
  name: string;
  /** One short line on what the script does. */
  description: string;
  /** Short points, one per feature: a list in the README, joined into @description. */
  features?: string[];
  match: string[];
  grant: string[];
  version: string;
  mode: ScriptMode;
  /**
   * When the script runs. `document-idle` when left out. A script that changes how the
   * page loads, such as hiding parts with CSS, runs at `document-start`, before the first paint.
   */
  runAt?: RunAt;
  /** Open scripts only: exact origins of the sign-in pages. Exempt from the guard's GET-only rule. */
  signInOrigins?: string[];
  /** Open scripts only: exact origins the site loads assets from. */
  cdnOrigins?: string[];
  /** Open scripts only: endpoints the guard lets POST through. */
  postExemptions?: PostExemption[];
}

interface Script {
  /** The folder name, also used in file names: `dist/<id>.user.js`. */
  id: string;
  directory: string;
  config: ScriptConfig;
}

function scriptJsonPath(id: string): string {
  return path.join(REPO_ROOT, id, "script.json");
}

/** Every top-level folder with a `script.json`, sorted by name. */
function findScriptIds(): string[] {
  return fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(scriptJsonPath(entry.name)))
    .map((entry) => entry.name)
    .toSorted();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRunAt(value: unknown): value is RunAt {
  return RUN_AT_VALUES.some((runAt) => runAt === value);
}

function problemsOf(config: Record<string, unknown>): string[] {
  const checks: [isValid: boolean, problem: string][] = [
    [typeof config.name === "string" && config.name !== "", "name is missing"],
    [typeof config.description === "string", "description is missing"],
    [
      config.features === undefined ||
        (isStringArray(config.features) && config.features.length > 0),
      "features must be a list of short points",
    ],
    [isStringArray(config.match) && config.match.length > 0, "match needs at least one pattern"],
    [isStringArray(config.grant), "grant must be a list"],
    [
      typeof config.version === "string" && VERSION_PATTERN.test(config.version),
      "version must be x.y.z",
    ],
    [config.mode === "open" || config.mode === "sealed", 'mode must be "open" or "sealed"'],
    [
      config.runAt === undefined || isRunAt(config.runAt),
      'runAt must be "document-start", "document-body", "document-end" or "document-idle"',
    ],
  ];
  return checks.filter(([isValid]) => !isValid).map(([, problem]) => problem);
}

/** The description and the features as one line, for the @description header. */
function oneLineDescription({ description, features = [] }: ScriptConfig): string {
  if (features.length === 0) {
    return description;
  }
  const points = features.map((point) => `${point.charAt(0).toLowerCase()}${point.slice(1)}`);
  return `${description.replace(/\.$/u, "")}: ${points.join("; ")}.`;
}

/** Parsed JSON, typed as unknown so callers narrow it. */
function readJsonFile(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readScript(id: string): Script {
  const json = readJsonFile(scriptJsonPath(id));
  const config: Partial<ScriptConfig> = isRecord(json) ? json : {};
  const problems = problemsOf(config);
  if (problems.length > 0) {
    throw new Error(`${id}/script.json: ${problems.join("; ")}`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- problemsOf checked every required field
  return { config: config as ScriptConfig, directory: path.join(REPO_ROOT, id), id };
}

/** The script named on the command line, or every script. Exits on an unknown name. */
function selectScripts(name: string | undefined): Script[] {
  const ids = findScriptIds();
  if (name === undefined) {
    return ids.map((id) => readScript(id));
  }
  if (!ids.includes(name)) {
    console.error(`Unknown script "${name}". Scripts: ${ids.join(", ") || "none"}`);
    process.exit(1);
  }
  return [readScript(name)];
}

/** `https://github.com/<owner>/<repo>`, from package.json. */
function repositoryUrl(): string {
  const packageJson = readJsonFile(path.join(REPO_ROOT, "package.json"));
  const repository =
    isRecord(packageJson) && isRecord(packageJson.repository)
      ? packageJson.repository.url
      : undefined;
  if (typeof repository !== "string") {
    throw new TypeError("package.json has no repository.url");
  }
  return repository.replace(/\.git$/u, "");
}

function releaseFilePath(id: string): string {
  return path.join(REPO_ROOT, "dist", `${id}.user.js`);
}

function devFilePath(id: string): string {
  return path.join(REPO_ROOT, "dist", "dev", `${id}.user.js`);
}

export type { PostExemption, RunAt, Script, ScriptConfig, ScriptMode };
export {
  REPO_ROOT,
  devFilePath,
  findScriptIds,
  isRecord,
  oneLineDescription,
  problemsOf,
  readJsonFile,
  readScript,
  releaseFilePath,
  repositoryUrl,
  scriptJsonPath,
  selectScripts,
};
