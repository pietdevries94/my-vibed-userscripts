import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildFixtureDom } from "../../../shared/dev/fake-site/fixture-dom.ts";
import { createSettingsPanel } from "./settings-panel.ts";
import { scriptFixtures } from "../../../shared/dev/fixtures.ts";
import { test } from "node:test";

const fixtures = scriptFixtures(import.meta.dirname);

function ignore(): void {
  // The test checks the button, not saving.
}

test(
  "the captured top bar (pr-list-top-bar) gets the settings button first, before Azure DevOps's own",
  { skip: fixtures.skip },
  () => {
    const { document } = new JSDOM("<!doctype html><body></body>").window;
    const root = buildFixtureDom(document, fixtures.read("pr-list-top-bar.html"));
    assert.ok(root, "the fixture has a root element");
    document.body.append(root);
    const topBar = document.querySelector(".region-header-menubar");
    const ownItemCount = topBar?.children.length ?? 0;
    const panel = createSettingsPanel({
      document,
      features: [],
      isOn: () => true,
      reload: ignore,
      save: ignore,
    });
    panel.sync();
    panel.sync();
    assert.equal(topBar?.children.length, ownItemCount + 1);
    assert.equal(
      topBar?.firstElementChild?.querySelector("button")?.getAttribute("aria-label"),
      "Fix Azure DevOps settings",
    );
  },
);
