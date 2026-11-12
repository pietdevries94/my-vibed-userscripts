import assert from "node:assert/strict";
import { test } from "node:test";
import { withScriptList } from "./readme.ts";

const README = "# Repo\n\n<!-- scripts:start -->\nold list\n<!-- scripts:end -->\n\nLicence.\n";

test("the table between the markers is replaced, the rest stays", () => {
  const readme = withScriptList(README, [
    {
      description: "Hides ads | banners.",
      id: "example-site",
      name: "Fix Example",
      version: "1.2.0",
    },
  ]);
  const [before, table, after] = readme.split(/<!-- scripts:(?:start|end) -->/u);
  assert.equal(before, "# Repo\n\n");
  assert.equal(after, "\n\nLicence.\n");
  const rows = (table ?? "").trim().split("\n");
  assert.deepEqual(rows.slice(0, 2), [
    "| Script | What it does | Version |",
    "| --- | --- | --- |",
  ]);
  assert.match(
    rows[2] ?? "",
    /^\| \[Fix Example\]\(https:\/\/raw\.githubusercontent\.com\/.+\/main\/dist\/example-site\.user\.js\) \| Hides ads \\\| banners\. \| 1\.2\.0 \|$/u,
  );
});

test("with no released script the list says so", () => {
  assert.match(withScriptList(README, []), /No script is released yet\./u);
});

test("a README without the markers is refused", () => {
  assert.throws(() => withScriptList("# Repo\n", []), /scripts:start/u);
});
