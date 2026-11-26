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

const DARK_SCHEME_RULE = '[data-win98-scheme="dark"] {';

function tokenNames(css: string): string[] {
  return [...css.matchAll(TOKEN_DEFINITION)].map((match) => match.groups?.token ?? "");
}

const tokensCss = read("shared/styles/win98/tokens.css");
const lightNames = tokenNames(tokensCss.slice(0, tokensCss.indexOf(DARK_SCHEME_RULE)));
const darkNames = tokenNames(tokensCss.slice(tokensCss.indexOf(DARK_SCHEME_RULE)));

test("tokens.css defines each token once per scheme", () => {
  for (const names of [lightNames, darkNames]) {
    assert.deepEqual(
      names.filter((name, index) => names.indexOf(name) !== index),
      [],
    );
  }
});

test("the dark scheme only overrides tokens the light scheme defines", () => {
  assert.ok(darkNames.length > 0);
  assert.deepEqual(
    darkNames.filter((name) => !lightNames.includes(name)),
    [],
  );
});
