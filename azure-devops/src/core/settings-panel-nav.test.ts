// The settings panel's side bar: its sections, What's new and search.
import { TOP_BAR, featureNamed, flip, pageWith, sectionNamed } from "./settings-panel.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const TWO_SECTIONS = [
  sectionNamed("Pull request", [featureNamed("tab", "Pipeline tab")]),
  {
    description: "Work item boards.",
    groups: [
      { features: [featureNamed("dots", "Days in column")] },
      { features: [featureNamed("lanes", "Lane totals")], name: "Lanes" },
    ],
    name: "Boards",
  },
];

test("the side bar lists the sections, and the panel opens on the first", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  const entries = [...page.document.querySelectorAll("dialog nav button")];
  assert.deepEqual(
    entries.map((entry) => entry.textContent),
    ["Pull request", "Boards"],
  );
  assert.equal(page.navItem("Pull request").getAttribute("aria-current"), "page");
  assert.equal(page.navItem("Boards").hasAttribute("aria-current"), false);
  assert.deepEqual(page.shownSections(), ["Pull request"]);
  assert.deepEqual(page.shownFeatures(), ["tab"]);
});

test("a side bar entry shows its section, with each named group under its heading", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  page.navItem("Boards").click();
  assert.equal(page.navItem("Boards").getAttribute("aria-current"), "page");
  assert.equal(page.navItem("Pull request").hasAttribute("aria-current"), false);
  assert.deepEqual(page.shownSections(), ["Boards"]);
  assert.deepEqual(page.shownFeatures(), ["dots", "lanes"]);
  const headings = [...page.document.querySelectorAll("dialog section h4")];
  assert.deepEqual(
    headings.map((heading) => heading.textContent),
    ["Lanes"],
  );
  assert.match(page.dialog()?.textContent ?? "", /Work item boards\./u);
});

test("a choice in a section that is not shown is saved too", () => {
  const page = pageWith(TOP_BAR, { onIds: ["tab", "dots", "lanes"], sections: TWO_SECTIONS });
  page.panel.open();
  page.navItem("Boards").click();
  flip(page.toggle("lanes"));
  page.navItem("Pull request").click();
  page.button("Save and reload page").click();
  assert.deepEqual(page.saved, [new Map([["lanes", false]])]);
});

test("search shows the matching features of every section, under their section names", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  page.search("  LANE ");
  assert.deepEqual(page.shownSections(), ["Boards"]);
  assert.deepEqual(page.shownFeatures(), ["lanes"]);
  assert.equal(page.document.querySelector("dialog nav [aria-current]"), null);
  page.search("days in column");
  assert.deepEqual(page.shownFeatures(), ["dots"]);
});

test("search matches a feature's description, section and group too", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  page.search("what pipeline tab does");
  assert.deepEqual(page.shownFeatures(), ["tab"]);
  page.search("boards");
  assert.deepEqual(page.shownFeatures(), ["dots", "lanes"]);
  page.search("lanes");
  assert.deepEqual(page.shownFeatures(), ["lanes"]);
});

test("a search without matches says so, and an empty search shows the section again", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  page.navItem("Boards").click();
  page.search("nothing like this");
  assert.deepEqual(page.shownSections(), []);
  const empty = page.document.querySelector(".fix-ado-settings-no-match");
  assert.equal(empty?.closest("[hidden]"), null);
  assert.equal(empty?.textContent, "No setting matches “nothing like this”.");
  page.search("");
  assert.deepEqual(page.shownSections(), ["Boards"]);
  assert.notEqual(empty?.closest("[hidden]"), null);
});

test("picking a side bar entry clears the search", () => {
  const page = pageWith(TOP_BAR, { sections: TWO_SECTIONS });
  page.panel.open();
  page.search("lanes");
  page.navItem("Pull request").click();
  assert.equal(
    page.document.querySelector<HTMLInputElement>("dialog input[type=search]")?.value,
    "",
  );
  assert.deepEqual(page.shownFeatures(), ["tab"]);
});

test("with unseen changes, the panel opens on What's new: the changed features by section", () => {
  const page = pageWith(TOP_BAR, {
    sections: [
      sectionNamed("Pull request", [
        featureNamed("tab", "Pipeline tab", { kind: "new", version: "2.0.0" }),
        featureNamed("stars", "Starred reviewers"),
      ]),
      sectionNamed("Boards", [
        featureNamed("dots", "Days in column", { kind: "updated", version: "2.1.0" }),
      ]),
    ],
  });
  page.panel.open();
  const entries = [...page.document.querySelectorAll("dialog nav button")];
  assert.deepEqual(
    entries.map((entry) => entry.textContent),
    ["What’s new2", "Pull request", "Boards"],
  );
  assert.equal(page.navItem("What’s new").getAttribute("aria-current"), "page");
  assert.deepEqual(page.shownSections(), ["Pull request", "Boards"]);
  assert.deepEqual(page.shownFeatures(), ["tab", "dots"]);
  page.navItem("Pull request").click();
  assert.deepEqual(page.shownFeatures(), ["tab", "stars"]);
});

test("without unseen changes, the side bar has no What's new", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  assert.doesNotMatch(page.document.querySelector("dialog nav")?.textContent ?? "", /new/u);
});
