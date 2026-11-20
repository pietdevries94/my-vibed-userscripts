import assert from "node:assert/strict";
import { test } from "node:test";
import { withScriptList } from "./readme.ts";

const README = "# Repo\n\n<!-- scripts:start -->\nold list\n<!-- scripts:end -->\n\nLicence.\n";

test("each script gets a section between the markers, the rest stays", () => {
  const readme = withScriptList(README, [
    { description: "Hides ads.", id: "example-site", name: "Fix Example", version: "1.2.0" },
  ]);
  const [before, list, after] = readme.split(/<!-- scripts:(?:start|end) -->/u);
  assert.equal(before, "# Repo\n\n");
  assert.equal(after, "\n\nLicence.\n");
  assert.match(
    list ?? "",
    /^\n\n### Fix Example\n\n\[Install\]\(https:\/\/raw\.githubusercontent\.com\/.+\/main\/dist\/example-site\.user\.js\) · version 1\.2\.0\n\nHides ads\.\n\n$/u,
  );
});

test("a script's features show as a list under each category name", () => {
  const readme = withScriptList(README, [
    {
      description: "Fixes an invented site.",
      features: [
        { category: "Lists", points: ["Hides ads", "Shows the time"] },
        { category: "Everywhere", points: ["Dark mode"] },
      ],
      id: "example-site",
      name: "Fix Example",
      version: "1.2.0",
    },
  ]);
  assert.match(
    readme,
    /Fixes an invented site\.\n\n\*\*Lists\*\*\n\n- Hides ads\n- Shows the time\n\n\*\*Everywhere\*\*\n\n- Dark mode\n\n<!-- scripts:end -->/u,
  );
});

test("with no released script the list says so", () => {
  assert.match(withScriptList(README, []), /No script is released yet\./u);
});

test("a README without the markers is refused", () => {
  assert.throws(() => withScriptList("# Repo\n", []), /scripts:start/u);
});
