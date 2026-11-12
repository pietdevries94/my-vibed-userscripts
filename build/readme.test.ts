import assert from "node:assert/strict";
import { test } from "node:test";
import { withScriptList } from "./readme.ts";

const README = "# Repo\n\n<!-- scripts:start -->\nold list\n<!-- scripts:end -->\n\nLicence.\n";

test("the list between the markers is replaced, the rest stays", () => {
  const readme = withScriptList(README, [
    { description: "Hides ads.", id: "example-site", name: "Fix Example", version: "1.2.0" },
  ]);
  assert.match(
    readme,
    /^# Repo\n\n<!-- scripts:start -->\n\n- \*\*Fix Example\*\* 1\.2\.0: Hides ads\. \[Install\]\(https:\/\/raw\.githubusercontent\.com\/.+\/main\/dist\/example-site\.user\.js\)\n\n<!-- scripts:end -->\n\nLicence\.\n$/u,
  );
});

test("with no released script the list says so", () => {
  assert.match(withScriptList(README, []), /No script is released yet\./u);
});

test("a README without the markers is refused", () => {
  assert.throws(() => withScriptList("# Repo\n", []), /scripts:start/u);
});
