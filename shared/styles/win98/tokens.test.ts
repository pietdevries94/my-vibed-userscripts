import { REPO_ROOT } from "../../../build/scripts.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const TOKEN_DEFINITION = /^\s*(?<token>--win98-[a-z0-9-]+):/gmu;
const TOKEN_USE = /var\((?<token>--win98-[a-z0-9-]+)\)/gu;

function read(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
}

const defined = new Set(
  [...read("shared/styles/win98/tokens.css").matchAll(TOKEN_DEFINITION)].map(
    (match) => match.groups?.token ?? "",
  ),
);

for (const file of [
  "shared/styles/win98/components.css",
  "azure-devops/src/features/windows-98-mode/style.css",
]) {
  test(`every Win98 token ${file} uses is defined in tokens.css`, () => {
    const used = new Set(
      [...read(file).matchAll(TOKEN_USE)].map((match) => match.groups?.token ?? ""),
    );
    assert.deepEqual(
      [...used].filter((token) => !defined.has(token)),
      [],
    );
  });
}

test("tokens.css defines each token once", () => {
  const names = [...read("shared/styles/win98/tokens.css").matchAll(TOKEN_DEFINITION)].map(
    (match) => match.groups?.token ?? "",
  );
  assert.deepEqual(
    names.filter((name, index) => names.indexOf(name) !== index),
    [],
  );
});
