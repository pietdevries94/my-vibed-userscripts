import type { Feature } from "./feature.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createSettingsPanel } from "./settings-panel.ts";
import { test } from "node:test";

const TOP_BAR = `
  <div class="region-header-menubar" role="menubar">
    <div role="menuitem"><button aria-label="Help"></button></div>
  </div>`;

const featureNamed = (id: string, name: string): Feature => ({
  description: `What ${name} does.`,
  id,
  name,
  start: () => null,
  styles: [],
});
const FEATURES = [featureNamed("tab", "Pipeline tab"), featureNamed("dots", "Days in column")];

interface TestPage {
  document: Document;
  reloads: number;
  saved: Map<string, boolean>[];
  panel: ReturnType<typeof createSettingsPanel>;
  checkbox: (id: string) => HTMLInputElement;
  button: (text: string) => HTMLButtonElement;
  dialog: () => HTMLDialogElement | null;
}

function openDialog(this: HTMLDialogElement): void {
  this.open = true;
}

function closeDialog(this: HTMLDialogElement): void {
  this.open = false;
}

function pageWith(body: string, onIds: string[] = ["tab", "dots"]): TestPage {
  const { window } = new JSDOM(`<!doctype html><body>${body}</body>`);
  // The test DOM has no modal dialogs.
  window.HTMLDialogElement.prototype.showModal = openDialog;
  window.HTMLDialogElement.prototype.close = closeDialog;
  const { document } = window;
  const page: TestPage = {
    button: (text) => {
      const found = [...document.querySelectorAll("dialog button")].find(
        (button) => button.textContent === text,
      );
      assert.ok(found instanceof window.HTMLButtonElement, `no button ${text}`);
      return found;
    },
    checkbox: (id) => {
      const found = document.querySelector(`dialog input[data-feature-id="${id}"]`);
      assert.ok(found instanceof window.HTMLInputElement, `no checkbox ${id}`);
      return found;
    },
    dialog: () => document.querySelector("dialog"),
    document,
    panel: createSettingsPanel({
      document,
      features: FEATURES,
      isOn: ({ id }) => onIds.includes(id),
      reload: () => {
        page.reloads += 1;
      },
      save: (choices) => {
        page.saved.push(choices);
      },
    }),
    reloads: 0,
    saved: [],
  };
  return page;
}

function flip(checkbox: HTMLInputElement): void {
  checkbox.checked = !checkbox.checked;
  const { Event } = checkbox.ownerDocument.defaultView ?? globalThis;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
}

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

test("the button opens the panel with a checkbox per feature, checked when on", () => {
  const page = pageWith(TOP_BAR, ["tab"]);
  page.panel.sync();
  page.document.querySelector<HTMLButtonElement>(".region-header-menubar button")?.click();
  assert.equal(page.dialog()?.open, true);
  assert.equal(page.checkbox("tab").checked, true);
  assert.equal(page.checkbox("dots").checked, false);
  assert.match(page.dialog()?.textContent ?? "", /Pipeline tab.*What Pipeline tab does\./su);
});

test("the panel warns that saving reloads the page", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  assert.match(
    page.dialog()?.textContent ?? "",
    /Saving reloads this page\. Anything you typed and did not save is lost\./u,
  );
});

test("Save and reload stays off until a choice changes, and back off when it is undone", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  const save = page.button("Save and reload");
  assert.equal(save.disabled, true);
  flip(page.checkbox("dots"));
  assert.equal(save.disabled, false);
  flip(page.checkbox("dots"));
  assert.equal(save.disabled, true);
});

test("Save and reload stores only the changed choices, then reloads", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.checkbox("dots"));
  page.button("Save and reload").click();
  assert.deepEqual(page.saved, [new Map([["dots", false]])]);
  assert.equal(page.reloads, 1);
});

test("Cancel closes the panel and stores nothing", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.checkbox("tab"));
  page.button("Cancel").click();
  assert.equal(page.dialog()?.open ?? false, false);
  assert.deepEqual(page.saved, []);
  assert.equal(page.reloads, 0);
});

test("opening again shows the stored choices, not the cancelled ones", () => {
  const page = pageWith(TOP_BAR);
  page.panel.open();
  flip(page.checkbox("tab"));
  page.button("Cancel").click();
  page.panel.open();
  assert.equal(page.checkbox("tab").checked, true);
  assert.equal(page.document.querySelectorAll("dialog").length, 1);
});
