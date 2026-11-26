import { TOP_BAR, featureNamed, flip, pageWith } from "./settings-panel.test-page.ts";
import type { Feature } from "./feature.ts";
import type { TestPage } from "./settings-panel.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const CHANGED_FEATURES = [
  featureNamed("tab", "Pipeline tab", { kind: "new", version: "2.0.0" }),
  featureNamed("dots", "Days in column", { kind: "updated", version: "2.1.0" }),
  featureNamed("stars", "Starred reviewers"),
];

test("adds one settings button at the start of Azure DevOps's top bar", () => {
  const page = pageWith(TOP_BAR);
  page.panel.sync();
  page.panel.sync();
  const items = [...page.document.querySelectorAll(".region-header-menubar > *")];
  assert.equal(items.length, 2);
  const button = items[0]?.querySelector("button");
  assert.equal(button?.getAttribute("aria-label"), "Fix Azure DevOps settings");
  assert.equal(button.title, "Fix Azure DevOps settings");
});

test("without a top bar, there is no button and nothing fails", () => {
  const page = pageWith("<main></main>");
  page.panel.sync();
  assert.equal(page.document.querySelector("button"), null);
});

test("the button opens the panel with a switch per feature, on when the feature is on", () => {
  const page = pageWith(TOP_BAR, { onIds: ["tab"] });
  page.panel.sync();
  page.document.querySelector<HTMLButtonElement>(".region-header-menubar button")?.click();
  assert.equal(page.dialog()?.open, true);
  assert.equal(page.isSwitchOn("tab"), true);
  assert.equal(page.toggle("tab").getAttribute("role"), "switch");
  assert.equal(page.isSwitchOn("dots"), false);
  assert.match(page.dialog()?.textContent ?? "", /Pipeline tab.*What Pipeline tab does\./su);
});

test("the footer counts the changed choices", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  const count = (): string =>
    page.document.querySelector(".fix-ado-settings-change-count")?.textContent ?? "";
  assert.equal(count(), "");
  flip(page.toggle("dots"));
  assert.equal(count(), "1 change");
  flip(page.toggle("tab"));
  assert.equal(count(), "2 changes");
});

test("the panel has no warning; the save button says that it reloads the page", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  assert.equal(page.document.querySelector("dialog [role=note]"), null);
  assert.doesNotMatch(page.dialog()?.textContent ?? "", /is lost/u);
  assert.equal(page.button("Save and reload page").disabled, true);
});

test("Save and reload page stays off until a choice changes, and back off when it is undone", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  const save = page.button("Save and reload page");
  assert.equal(save.disabled, true);
  flip(page.toggle("dots"));
  assert.equal(save.disabled, false);
  flip(page.toggle("dots"));
  assert.equal(save.disabled, true);
});

test("Save and reload page stores only the changed choices, then reloads", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.toggle("dots"));
  page.button("Save and reload page").click();
  assert.deepEqual(page.saved, [new Map([["dots", false]])]);
  assert.equal(page.reloads, 1);
});

test("Cancel closes the panel and stores nothing", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.toggle("tab"));
  page.button("Cancel").click();
  assert.equal(page.dialog()?.open ?? false, false);
  assert.deepEqual(page.saved, []);
  assert.equal(page.reloads, 0);
});

test("opening again shows the stored choices, not the cancelled ones", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.toggle("tab"));
  page.button("Cancel").click();
  page.panel.open();
  assert.equal(page.isSwitchOn("tab"), true);
  assert.equal(page.document.querySelectorAll("dialog").length, 1);
});

const badge = (page: TestPage): string | null =>
  page.document.querySelector(".region-header-menubar .fix-ado-settings-badge")?.textContent ??
  null;
const chip = (page: TestPage, id: string): string | null =>
  page.toggle(id).querySelector(".fix-ado-settings-chip")?.textContent ?? null;

test("the button shows how many feature changes the owner has not seen", () => {
  const page = pageWith(TOP_BAR, { features: CHANGED_FEATURES });
  page.panel.sync();
  assert.equal(badge(page), "2");
});

test("a change the owner has seen is not counted, nor is an older one they saw", () => {
  const page = pageWith(TOP_BAR, {
    features: CHANGED_FEATURES,
    seen: new Map([
      ["tab", "2.0.0"],
      ["dots", "2.0.0"],
    ]),
  });
  page.panel.sync();
  assert.equal(badge(page), "1");
});

test("without unseen changes the button has no badge", () => {
  const page = pageWith(TOP_BAR);
  page.panel.sync();
  assert.equal(badge(page), null);
});

test("the panel shows a New or Updated chip on each unseen change", () => {
  const page = pageWith(TOP_BAR, {
    features: CHANGED_FEATURES,
    seen: new Map([
      ["tab", "2.0.0"],
      ["dots", "2.0.0"],
    ]),
  });
  page.panel.open();
  assert.equal(chip(page, "tab"), null);
  assert.equal(chip(page, "dots"), "Updated");
  assert.equal(chip(page, "stars"), null);
});

test("opening the panel marks its changes seen and removes the badge", () => {
  const page = pageWith(TOP_BAR, {
    features: CHANGED_FEATURES,
    seen: new Map([["dots", "2.0.0"]]),
  });
  page.panel.sync();
  page.document.querySelector<HTMLButtonElement>(".region-header-menubar button")?.click();
  assert.equal(chip(page, "tab"), "New");
  assert.equal(chip(page, "dots"), "Updated");
  assert.deepEqual(
    page.seen,
    new Map([
      ["tab", "2.0.0"],
      ["dots", "2.1.0"],
    ]),
  );
  assert.equal(badge(page), null);
  page.button("Cancel").click();
  page.panel.open();
  assert.equal(chip(page, "tab"), null);
});

test("a feature the owner never saw shows New, even when its change is an update", () => {
  const page = pageWith(TOP_BAR, {
    features: [featureNamed("dots", "Days in column", { kind: "updated", version: "2.1.0" })],
  });
  page.panel.open();
  assert.equal(chip(page, "dots"), "New");
});

const chips = (page: TestPage, id: string): string[] =>
  [...(page.toggle(id).querySelectorAll(".fix-ado-settings-chip") ?? [])].map(
    (found) => found.textContent,
  );

test("a feature's tag shows as a chip after its name, also once its change is seen", () => {
  const tagged: Feature = {
    ...featureNamed("retro", "Retro look", { kind: "new", version: "2.0.0" }),
    tag: "WIP",
  };
  const page = pageWith(TOP_BAR, { features: [tagged, featureNamed("tab", "Pipeline tab")] });
  page.panel.open();
  assert.deepEqual(chips(page, "retro"), ["New", "WIP"]);
  assert.deepEqual(chips(page, "tab"), []);
  page.button("Cancel").click();
  page.panel.open();
  assert.deepEqual(chips(page, "retro"), ["WIP"]);
});

test("the panel links to a new GitHub issue, opened in a new tab", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  const link = page.document.querySelector<HTMLAnchorElement>("dialog a");
  assert.equal(link?.textContent, "Report a bug or suggest a feature");
  assert.equal(link.href, "https://github.com/pietdevries94/my-vibed-userscripts/issues/new");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
});

test("the panel is named by its visible heading", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  const dialog = page.dialog();
  const heading = page.document.querySelector(`#${dialog?.getAttribute("aria-labelledby") ?? ""}`);
  assert.equal(heading?.textContent, "Fix Azure DevOps settings");
  assert.equal(dialog?.hasAttribute("aria-label"), false);
});

test("the button's name says how many changes are unseen, until the panel opens", () => {
  const page = pageWith(TOP_BAR, { features: CHANGED_FEATURES });
  page.panel.sync();
  const button = page.document.querySelector(".region-header-menubar button");
  assert.equal(button?.getAttribute("aria-label"), "Fix Azure DevOps settings, 2 new or updated");
  assert.equal(
    page.document.querySelector(".fix-ado-settings-badge")?.getAttribute("aria-hidden"),
    "true",
  );
  page.panel.open();
  assert.equal(button?.getAttribute("aria-label"), "Fix Azure DevOps settings");
});
