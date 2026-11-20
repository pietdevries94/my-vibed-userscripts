import type { Script, ScriptConfig } from "./scripts.ts";
import assert from "node:assert/strict";
import { metadataBlock } from "./bundle.ts";
import { problemsOf } from "./scripts.ts";
import { test } from "node:test";

function scriptWith(config: Partial<ScriptConfig>): Script {
  return {
    config: {
      description: "An invented script.",
      grant: [],
      match: ["https://example.test/*"],
      mode: "open",
      name: "Invented",
      version: "1.0.0",
      ...config,
    },
    directory: "/nonexistent/invented",
    id: "invented",
  };
}

function runAtOf(block: string): string | undefined {
  return /^\/\/ @run-at\s+(?<runAt>\S+)$/mu.exec(block)?.groups?.runAt;
}

test("a script runs at document-idle unless its script.json says otherwise", () => {
  const block = metadataBlock(scriptWith({}), "release");
  assert.equal(runAtOf(block), "document-idle");
});

test("a script's runAt sets @run-at, in the release and the dev file", () => {
  const script = scriptWith({ runAt: "document-start" });
  assert.equal(runAtOf(metadataBlock(script, "release")), "document-start");
  assert.equal(runAtOf(metadataBlock(script, "dev")), "document-start");
});

test("runAt must be a Violentmonkey run-at value", () => {
  const config: Record<string, unknown> = { ...scriptWith({}).config, runAt: "whenever" };
  assert.deepEqual(problemsOf(config), [
    'runAt must be "document-start", "document-body", "document-end" or "document-idle"',
  ]);
});

function descriptionOf(block: string): string | undefined {
  return /^\/\/ @description\s+(?<text>.+)$/mu.exec(block)?.groups?.text;
}

test("@description is the description alone for a script without features", () => {
  const block = metadataBlock(scriptWith({}), "release");
  assert.equal(descriptionOf(block), "An invented script.");
});

test("@description joins a script's features into its one line, by category", () => {
  const script = scriptWith({
    description: "Fixes an invented site.",
    features: [
      { category: "Lists", points: ["Hides ads", "Shows the time"] },
      { category: "Everywhere", points: ["Dark mode"] },
    ],
  });
  assert.equal(
    descriptionOf(metadataBlock(script, "release")),
    "Fixes an invented site. Lists: Hides ads; Shows the time. Everywhere: Dark mode.",
  );
});

test("features must be groups of points under a category name", () => {
  for (const features of [
    "Hides ads",
    [["Hides ads"]],
    [{ category: "", points: ["Hides ads"] }],
  ]) {
    const config: Record<string, unknown> = { ...scriptWith({}).config, features };
    assert.deepEqual(problemsOf(config), [
      "features must be groups, each a category name and its short points",
    ]);
  }
});
