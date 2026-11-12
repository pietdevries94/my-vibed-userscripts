// The README's script list: one line per released script, between two markers.
// The release command rewrites it, so the list always matches the release files.
import { REPO_ROOT, findScriptIds, readScript, releaseFilePath } from "./scripts.ts";
import fs from "node:fs";
import path from "node:path";
import { releaseInstallUrl } from "./bundle.ts";
import { versionOf } from "./versions.ts";

interface ReleasedScript {
  id: string;
  name: string;
  description: string;
  version: string;
}

const README_FILE = path.join(REPO_ROOT, "README.md");
const LIST_START = "<!-- scripts:start -->";
const LIST_END = "<!-- scripts:end -->";

function scriptListMarkdown(scripts: ReleasedScript[]): string {
  const lines = scripts.map(
    ({ id, name, description, version }) =>
      `- **${name}** ${version}: ${description} [Install](${releaseInstallUrl(id)})`,
  );
  return lines.length === 0 ? "No script is released yet." : lines.join("\n");
}

/** `readme` with the text between the markers replaced by the list. */
function withScriptList(readme: string, scripts: ReleasedScript[]): string {
  const start = readme.indexOf(LIST_START);
  const end = readme.indexOf(LIST_END);
  if (start === -1 || end < start) {
    throw new Error(`README.md needs the lines ${LIST_START} and ${LIST_END}.`);
  }
  const list = `${LIST_START}\n\n${scriptListMarkdown(scripts)}\n\n`;
  return `${readme.slice(0, start)}${list}${readme.slice(end)}`;
}

/** Every script with a release file, with the version in that file. */
function releasedScripts(): ReleasedScript[] {
  return findScriptIds().flatMap((id) => {
    const file = releaseFilePath(id);
    const version = fs.existsSync(file) ? versionOf(fs.readFileSync(file, "utf8")) : null;
    if (version === null) {
      return [];
    }
    const { name, description } = readScript(id).config;
    return [{ description, id, name, version }];
  });
}

/** Rewrites the README's script list from the release files. */
function updateReadme(): void {
  const readme = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, withScriptList(readme, releasedScripts()));
}

export type { ReleasedScript };
export { README_FILE, updateReadme, withScriptList };
