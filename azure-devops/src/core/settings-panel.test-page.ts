import type { Feature, SettingsSection } from "./feature.ts";
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
const sectionNamed = (name: string, features: Feature[]): SettingsSection => ({
  description: `What the ${name} settings change.`,
  groups: [{ features }],
  name,
});
const FEATURES = [featureNamed("tab", "Pipeline tab"), featureNamed("dots", "Days in column")];

/** Lookups and actions in the open panel. */
interface DialogQueries {
  button: (text: string) => HTMLButtonElement;
  /** The switch of the feature with this id. */
  toggle: (id: string) => HTMLButtonElement;
  /** Whether the switch of the feature with this id is on. */
  isSwitchOn: (id: string) => boolean;
  dialog: () => HTMLDialogElement | null;
  /** The side bar entry with this name, without its count. */
  navItem: (name: string) => HTMLButtonElement;
  search: (text: string) => void;
  /** The ids of the features that show, in order. */
  shownFeatures: () => string[];
  /** The names of the sections that show, in order. */
  shownSections: () => string[];
}

interface TestPage extends DialogQueries {
  document: Document;
  reloads: number;
  saved: Map<string, boolean>[];
  /** The change version the owner has seen, by feature id. */
  seen: Map<string, string>;
  panel: ReturnType<typeof createSettingsPanel>;
}

function openDialog(this: HTMLDialogElement): void {
  this.open = true;
}

function closeDialog(this: HTMLDialogElement): void {
  this.open = false;
}

function found<Found>(item: Found | null | undefined, message: string): Found {
  assert.ok(item !== null && item !== undefined, message);
  return item;
}

function shown(document: Document, selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`dialog ${selector}`)].filter(
    (item) => !item.closest("[hidden]"),
  );
}

function dialogQueries(window: JSDOM["window"]): DialogQueries {
  const { document } = window;
  const buttons = (selector: string): HTMLButtonElement[] => [
    ...document.querySelectorAll<HTMLButtonElement>(selector),
  ];
  const toggle = (id: string): HTMLButtonElement =>
    found(
      document.querySelector<HTMLButtonElement>(`dialog [data-feature-id="${id}"]`),
      `no switch ${id}`,
    );
  return {
    button: (text) =>
      found(
        buttons("dialog .fix-ado-settings-buttons button").find(
          (button) => button.textContent === text,
        ),
        `no button ${text}`,
      ),
    dialog: () => document.querySelector("dialog"),
    isSwitchOn: (id) => toggle(id).getAttribute("aria-checked") === "true",
    navItem: (name) =>
      found(
        buttons("dialog nav button").find((item) => item.firstElementChild?.textContent === name),
        `no side bar entry ${name}`,
      ),
    search: (text) => {
      const field = found(
        document.querySelector<HTMLInputElement>("dialog input[type=search]"),
        "no search field",
      );
      field.value = text;
      field.dispatchEvent(new window.Event("input", { bubbles: true }));
    },
    shownFeatures: () =>
      shown(document, "[data-feature-id]").map((input) => input.dataset.featureId ?? ""),
    shownSections: () =>
      shown(document, "section").map((section) => section.querySelector("h3")?.textContent ?? ""),
    toggle,
  };
}

interface PageSetup {
  onIds?: string[];
  /** Listed in one section, unless `sections` is given. */
  features?: Feature[];
  sections?: SettingsSection[];
  seen?: Map<string, string>;
}

function pageWith(
  body: string,
  {
    onIds = ["tab", "dots"],
    features = FEATURES,
    sections = [sectionNamed("Pull request", features)],
    seen = new Map(),
  }: PageSetup = {},
): TestPage {
  const { window } = new JSDOM(`<!doctype html><body>${body}</body>`);
  // The test DOM has no modal dialogs.
  window.HTMLDialogElement.prototype.showModal = openDialog;
  window.HTMLDialogElement.prototype.close = closeDialog;
  const { document } = window;
  const page: TestPage = {
    ...dialogQueries(window),
    document,
    panel: createSettingsPanel({
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
      sections,
      seenChangeVersion: ({ id }) => page.seen.get(id) ?? null,
    }),
    reloads: 0,
    saved: [],
    seen,
  };
  return page;
}

/** Clicks the switch, as the owner does. */
function flip(toggle: HTMLButtonElement): void {
  toggle.click();
}

export type { TestPage };
export { TOP_BAR, featureNamed, flip, pageWith, sectionNamed };
