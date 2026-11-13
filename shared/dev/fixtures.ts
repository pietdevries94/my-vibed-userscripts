// Fixture access for tests. Fixture tests live in `*.fixtures.test.ts` and pass
// `skip` to node:test, so they skip with a message when the script has no fixtures.
// `npm run test:fixtures` fails before it gets here when fixtures are missing.
import fs from "node:fs";
import path from "node:path";

interface ScriptFixtures {
  /** False when fixtures are there, else the message node:test prints for the skip. */
  skip: string | false;
  read: (name: string) => string;
}

/** The script folder: the nearest folder above `directory` that holds a `script.json`. */
function scriptDirectoryOf(directory: string): string {
  let current = directory;
  while (!fs.existsSync(path.join(current, "script.json"))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`no script.json above ${directory}`);
    }
    current = parent;
  }
  return current;
}

/** The fixtures of the script that holds `sourceDirectory`, at any depth (pass `import.meta.dirname`). */
function scriptFixtures(sourceDirectory: string): ScriptFixtures {
  const scriptDirectory = scriptDirectoryOf(sourceDirectory);
  const directory = path.join(scriptDirectory, "fixtures");
  const scriptId = path.basename(scriptDirectory);
  const isPresent = fs.existsSync(directory);
  return {
    read: (name) => fs.readFileSync(path.join(directory, name), "utf8"),
    skip: isPresent ? false : `no fixtures: ${scriptId}/fixtures is missing`,
  };
}

export type { ScriptFixtures };
export { scriptFixtures };
