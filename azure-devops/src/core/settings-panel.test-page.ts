import type { Feature, FeatureCategory } from "./feature.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createSettingsPanel } from "./settings-panel.ts";

const TOP_BAR = `
  <div class="region-header-menubar" role="menubar">
    <div role="menuitem"><button aria-label="Help"></button></div>
  </div>`;

const featureNamed = (id: string, name: string, change?: Feature["change"]): Feature => ({
  change,
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
  /** The change version the owner has seen, by feature id. */
  seen: Map<string, string>;
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

function dialogButton(document: Document, text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find(
    (button) => button.textContent === text,
  );
  assert.ok(found, `no button ${text}`);
  return found;
}

interface PageSetup {
  onIds?: string[];
  /** Listed in one category, unless `categories` is given. */
  features?: Feature[];
  categories?: FeatureCategory[];
  seen?: Map<string, string>;
}

function pageWith(
  body: string,
  {
    onIds = ["tab", "dots"],
    features = FEATURES,
    categories = [{ features, name: "Pull request" }],
    seen = new Map(),
  }: PageSetup = {},
): TestPage {
  const { window } = new JSDOM(`<!doctype html><body>${body}</body>`);
  // The test DOM has no modal dialogs.
  window.HTMLDialogElement.prototype.showModal = openDialog;
  window.HTMLDialogElement.prototype.close = closeDialog;
  const { document } = window;
  const page: TestPage = {
    button: (text) => dialogButton(document, text),
    checkbox: (id) => {
      const found = document.querySelector(`dialog input[data-feature-id="${id}"]`);
      assert.ok(found instanceof window.HTMLInputElement, `no checkbox ${id}`);
      return found;
    },
    dialog: () => document.querySelector("dialog"),
    document,
    panel: createSettingsPanel({
      categories,
      document,
      isOn: ({ id }) => onIds.includes(id),
      markChangesSeen: (seenFeatures) => {
        for (const { id, change } of seenFeatures) {
          if (change) {
            page.seen.set(id, change.version);
          }
        }
      },
      reload: () => {
        page.reloads += 1;
      },
      save: (choices) => {
        page.saved.push(choices);
      },
      seenChangeVersion: ({ id }) => page.seen.get(id) ?? null,
    }),
    reloads: 0,
    saved: [],
    seen,
  };
  return page;
}

function flip(checkbox: HTMLInputElement): void {
  checkbox.checked = !checkbox.checked;
  const { Event } = checkbox.ownerDocument.defaultView ?? globalThis;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
}

export type { TestPage };
export { TOP_BAR, featureNamed, flip, pageWith };
