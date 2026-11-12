import type { BuildOptions } from "esbuild";
import type { Script } from "./scripts.ts";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { repositoryUrl } from "./scripts.ts";

type BuildTarget = "release" | "dev";

const DEV_SERVER_PORT = 8786;
const FAKE_SITE_PORT = 8787;
const KEY_PADDING = 2;

/** Fixed options, so the same source always gives the same file. `check:dist` depends on it. */
const REPRODUCIBLE_OPTIONS = {
  bundle: true,
  charset: "utf8",
  format: "iife",
  legalComments: "none",
  loader: { ".css": "text" },
  logLevel: "silent",
  minify: false,
  platform: "browser",
  sourcemap: false,
  target: "firefox128",
  write: false,
} satisfies BuildOptions;

function hasFakeSite(script: Script): boolean {
  return fs.existsSync(path.join(script.directory, "fake-site"));
}

function hasCapture(script: Script): boolean {
  return fs.existsSync(path.join(script.directory, "src", "capture.ts"));
}

function releaseInstallUrl(id: string): string {
  const [owner, repository] = new URL(repositoryUrl()).pathname.split("/").filter(Boolean);
  return `https://raw.githubusercontent.com/${owner}/${repository}/main/dist/${id}.user.js`;
}

function metadataLines(script: Script, target: BuildTarget): [key: string, value: string][] {
  const { config } = script;
  const isDev = target === "dev";
  const matches =
    isDev && hasFakeSite(script)
      ? [...config.match, `http://localhost:${FAKE_SITE_PORT}/*`]
      : config.match;
  const grants = isDev ? [...new Set([...config.grant, "GM_registerMenuCommand"])] : config.grant;
  return [
    ["name", isDev ? `${config.name} (dev)` : config.name],
    ["namespace", repositoryUrl()],
    ["version", config.version],
    ["description", config.description],
    ...matches.map((pattern): [string, string] => ["match", pattern]),
    ...(grants.length > 0 ? grants : ["none"]).map((grant): [string, string] => ["grant", grant]),
    ["run-at", "document-idle"],
    ...(isDev ? [] : [["downloadURL", releaseInstallUrl(script.id)] satisfies [string, string]]),
  ];
}

/**
 * The metadata block. The dev file gets its own name, no `@downloadURL`, the
 * `GM_registerMenuCommand` grant for the capture command, and the fake site.
 */
function metadataBlock(script: Script, target: BuildTarget): string {
  const lines = metadataLines(script, target);
  const width = Math.max(...lines.map(([key]) => key.length)) + KEY_PADDING;
  const body = lines.map(([key, value]) => `// @${key.padEnd(width)}${value}`);
  return ["// ==UserScript==", ...body, "// ==/UserScript=="].join("\n");
}

const SHARED_CAPTURE_MODULE = "../shared/dev/capture/capture.ts";
/** The name the capture bundle's exports get inside the browser_evaluate function. */
const CAPTURE_BUNDLE_NAME = "fixtureCapture";

/** The code part of the dev entry: the script itself, plus its capture command. */
function devEntryContents(script: Script): string {
  const lines = ['import "./src/main.ts";'];
  if (hasCapture(script)) {
    lines.push(
      'import { captureDefinition } from "./src/capture.ts";',
      `import { registerCapture } from "${SHARED_CAPTURE_MODULE}";`,
      "registerCapture(captureDefinition);",
    );
  }
  return lines.join("\n");
}

function esbuildOptions(script: Script, target: BuildTarget): BuildOptions {
  const entry: BuildOptions =
    target === "release"
      ? { entryPoints: [path.join(script.directory, "src", "main.ts")] }
      : {
          stdin: {
            contents: devEntryContents(script),
            loader: "ts",
            resolveDir: script.directory,
            sourcefile: "dev-entry.ts",
          },
        };
  // The release build drops log() calls. Dropping a call needs syntax minification;
  // names and whitespace stay, so the release file stays readable.
  const releaseOnly: BuildOptions =
    target === "release" ? { minifySyntax: true, pure: ["log"] } : {};
  return {
    ...REPRODUCIBLE_OPTIONS,
    ...entry,
    ...releaseOnly,
    banner: { js: metadataBlock(script, target) },
  };
}

/** The full `.user.js` text. The metadata block comes first, as Violentmonkey requires. */
async function bundleScript(script: Script, target: BuildTarget): Promise<string> {
  const result = await build(esbuildOptions(script, target));
  const [file] = result.outputFiles ?? [];
  if (file === undefined) {
    throw new Error(`${script.id}: esbuild gave no output`);
  }
  return file.text;
}

/**
 * The script's capture as one async function for `browser_evaluate`. It returns the
 * scrubbed files, or null off the capture list. Its names stay local to the function.
 */
async function bundleCapture(script: Script): Promise<string> {
  if (!hasCapture(script)) {
    throw new Error(`${script.id} has no src/capture.ts`);
  }
  const result = await build({
    ...REPRODUCIBLE_OPTIONS,
    globalName: CAPTURE_BUNDLE_NAME,
    stdin: {
      contents: [
        'import { captureDefinition } from "./src/capture.ts";',
        `import { captureFiles } from "${SHARED_CAPTURE_MODULE}";`,
        "export const run = async () => captureFiles(captureDefinition);",
      ].join("\n"),
      loader: "ts",
      resolveDir: script.directory,
      sourcefile: "capture-entry.ts",
    },
  });
  const [file] = result.outputFiles ?? [];
  if (file === undefined) {
    throw new Error(`${script.id}: esbuild gave no capture output`);
  }
  return `async () => {\n${file.text}\nreturn ${CAPTURE_BUNDLE_NAME}.run();\n}\n`;
}

/** Drops the `@version` line, to compare two builds whatever their version. */
function withoutVersion(userScript: string): string {
  return userScript.replace(/^\/\/ @version .*$/mu, "");
}

export type { BuildTarget };
export {
  DEV_SERVER_PORT,
  FAKE_SITE_PORT,
  bundleCapture,
  bundleScript,
  esbuildOptions,
  hasFakeSite,
  metadataBlock,
  releaseInstallUrl,
  withoutVersion,
};
