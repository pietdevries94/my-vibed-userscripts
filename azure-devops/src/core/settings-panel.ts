import {
  BADGE_CLASS,
  BUTTON_ITEM_CLASS,
  SETTINGS_TITLE,
  createSettingsButtonItem,
} from "./settings-button.ts";
import type { Feature, FeatureCategory, FeatureChange } from "./feature.ts";
import { button, element } from "./settings-panel-markup.ts";

const ISSUE_LINK_TEXT = "Found a bug or have a suggestion?";
const NEW_ISSUE_URL = "https://github.com/pietdevries94/my-vibed-userscripts/issues/new";
const TOP_BAR_SELECTOR = ".region-header-menubar";
const DIALOG_CLASS = "fix-ado-settings";
const CHIP_TEXT = { new: "New", updated: "Updated" } as const;

interface SettingsPanelOptions {
  document: Document;
  /** In the order the panel lists them. */
  categories: FeatureCategory[];
  isOn: (feature: Feature) => boolean;
  /** The version of the feature's latest change the owner has seen, or null when none. */
  seenChangeVersion: (feature: Feature) => string | null;
  /** Stores that the owner has seen the current change of these features. */
  markChangesSeen: (features: Feature[]) => void;
  /** Stores the changed choices, by feature id. */
  save: (choices: Map<string, boolean>) => void;
  reload: () => void;
}

interface SettingsPanel {
  /** Adds the settings button to Azure DevOps's top bar when the bar is there without it. */
  sync: () => void;
  open: () => void;
}

function allFeatures({ categories }: SettingsPanelOptions): Feature[] {
  return categories.flatMap((category) => category.features);
}

/** The features with a change the owner has not seen. */
function featuresWithUnseenChange(options: SettingsPanelOptions): Feature[] {
  return allFeatures(options).filter(
    (feature) =>
      feature.change !== undefined && options.seenChangeVersion(feature) !== feature.change.version,
  );
}

/** A feature the owner never saw a change of is new to them, even when its change is an update. */
function chipKind(feature: Feature, options: SettingsPanelOptions): FeatureChange["kind"] {
  if (options.seenChangeVersion(feature) === null) {
    return "new";
  }
  return feature.change?.kind ?? "new";
}

/** The feature's name, with a New or Updated chip while its change is unseen. */
function featureName(
  document: Document,
  feature: Feature,
  chip: FeatureChange["kind"] | null,
): HTMLElement {
  const name = element(document, "span", {
    className: "fix-ado-settings-feature-name",
    text: feature.name,
  });
  if (chip) {
    name.append(
      element(document, "span", {
        className: `fix-ado-settings-chip fix-ado-settings-chip-${chip}`,
        text: CHIP_TEXT[chip],
      }),
    );
  }
  return name;
}

interface FeatureRowParts {
  feature: Feature;
  isOn: boolean;
  /** Null when the feature has no unseen change. */
  chip: FeatureChange["kind"] | null;
}

function featureRow(document: Document, { feature, isOn, chip }: FeatureRowParts): HTMLElement {
  const row = element(document, "label", { className: "fix-ado-settings-feature" });
  const checkbox = element(document, "input", { className: "fix-ado-settings-checkbox" });
  checkbox.type = "checkbox";
  checkbox.checked = isOn;
  checkbox.dataset.featureId = feature.id;
  const text = element(document, "span", { className: "fix-ado-settings-feature-text" });
  text.append(
    featureName(document, feature, chip),
    element(document, "span", {
      className: "fix-ado-settings-feature-description",
      text: feature.description,
    }),
  );
  row.append(checkbox, text);
  return row;
}

/** The choices that differ from the stored ones, by feature id. */
function changedChoices(dialog: HTMLElement, options: SettingsPanelOptions): Map<string, boolean> {
  const changed = new Map<string, boolean>();
  for (const feature of allFeatures(options)) {
    const checkbox = dialog.querySelector<HTMLInputElement>(
      `input[data-feature-id="${feature.id}"]`,
    );
    if (checkbox && checkbox.checked !== options.isOn(feature)) {
      changed.set(feature.id, checkbox.checked);
    }
  }
  return changed;
}

/** Opens a new issue on the script's GitHub repository, in a new tab. */
function issueLink(document: Document): HTMLAnchorElement {
  const link = element(document, "a", {
    className: "fix-ado-settings-issue-link",
    text: ISSUE_LINK_TEXT,
  });
  link.href = NEW_ISSUE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function createButtons(
  dialog: HTMLDialogElement,
  options: SettingsPanelOptions,
): { buttons: HTMLElement; save: HTMLButtonElement } {
  const { document } = options;
  const cancel = button(
    document,
    { className: "bolt-button enabled bolt-focus-treatment", text: "Cancel" },
    () => {
      dialog.close();
    },
  );
  const save = button(
    document,
    { className: "bolt-button enabled primary bolt-focus-treatment", text: "Save and reload page" },
    () => {
      options.save(changedChoices(dialog, options));
      options.reload();
    },
  );
  save.disabled = true;
  const buttons = element(document, "div", { className: "fix-ado-settings-buttons" });
  buttons.append(issueLink(document), cancel, save);
  return { buttons, save };
}

/** A category's name as a heading, above a card per feature. */
function categorySection(
  category: FeatureCategory,
  options: SettingsPanelOptions,
  unseen: Feature[],
): HTMLElement {
  const { document } = options;
  const section = element(document, "section", { className: "fix-ado-settings-category" });
  const cards = element(document, "div", { className: "fix-ado-settings-features" });
  cards.append(
    ...category.features.map((feature) =>
      featureRow(document, {
        chip: unseen.includes(feature) ? chipKind(feature, options) : null,
        feature,
        isOn: options.isOn(feature),
      }),
    ),
  );
  section.append(
    element(document, "h3", { className: "fix-ado-settings-category-name", text: category.name }),
    cards,
  );
  return section;
}

function createDialog(options: SettingsPanelOptions, unseen: Feature[]): HTMLDialogElement {
  const { document } = options;
  const dialog = element(document, "dialog", { className: DIALOG_CLASS });
  dialog.setAttribute("aria-label", SETTINGS_TITLE);
  const { buttons, save } = createButtons(dialog, options);
  dialog.addEventListener("change", () => {
    save.disabled = changedChoices(dialog, options).size === 0;
  });
  dialog.append(
    element(document, "h2", { className: "fix-ado-settings-title", text: SETTINGS_TITLE }),
    ...options.categories.map((category) => categorySection(category, options, unseen)),
    buttons,
  );
  return dialog;
}

/** The script's own panel where the owner turns each feature on or off. Saving reloads the page. */
function createSettingsPanel(options: SettingsPanelOptions): SettingsPanel {
  const { document } = options;

  function open(): void {
    // Built fresh, so it shows the stored choices and not ones a Cancel left behind.
    document.querySelector(`dialog.${DIALOG_CLASS}`)?.remove();
    const unseen = featuresWithUnseenChange(options);
    const dialog = createDialog(options, unseen);
    document.body.append(dialog);
    dialog.showModal();
    // The chips stay while this panel is open; the badge and the next panel show none.
    if (unseen.length > 0) {
      options.markChangesSeen(unseen);
      document.querySelector(`.${BUTTON_ITEM_CLASS} .${BADGE_CLASS}`)?.remove();
    }
  }

  return {
    open,
    sync() {
      const topBar = document.querySelector(TOP_BAR_SELECTOR);
      if (topBar && !topBar.querySelector(`.${BUTTON_ITEM_CLASS}`)) {
        topBar.prepend(
          createSettingsButtonItem(document, open, featuresWithUnseenChange(options).length),
        );
      }
    },
  };
}

export type { SettingsPanel };
export { createSettingsPanel };
