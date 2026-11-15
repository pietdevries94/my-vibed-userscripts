import type { Feature, FeatureChange } from "./feature.ts";

const TITLE = "Fix Azure DevOps settings";
const RELOAD_WARNING = "Saving reloads this page. Anything you typed and did not save is lost.";
const TOP_BAR_SELECTOR = ".region-header-menubar";
const BUTTON_ITEM_CLASS = "fix-ado-settings-item";
const DIALOG_CLASS = "fix-ado-settings";
const BADGE_CLASS = "fix-ado-settings-badge";
const CHIP_TEXT = { new: "New", updated: "Updated" } as const;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

interface SettingsPanelOptions {
  document: Document;
  /** In the order the panel lists them. */
  features: Feature[];
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

interface ElementParts {
  className: string;
  text?: string;
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: Tag,
  { className, text }: ElementParts,
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

function button(document: Document, parts: ElementParts, onClick: () => void): HTMLButtonElement {
  const created = element(document, "button", parts);
  created.type = "button";
  created.addEventListener("click", onClick);
  return created;
}

function svgElement(document: Document, tag: string, attributes: Record<string, string>): Element {
  const created = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  return created;
}

/** A puzzle piece: the script's own mark, in a colour Azure DevOps does not use. */
function puzzleIcon(document: Document): Element {
  const svg = svgElement(document, "svg", {
    "aria-hidden": "true",
    class: "fix-ado-settings-icon",
    viewBox: "0 0 16 16",
  });
  svg.append(
    svgElement(document, "rect", { height: "10.5", rx: "1", width: "10", x: "1.5", y: "4" }),
    svgElement(document, "circle", { cx: "6.5", cy: "3.25", r: "2.25" }),
    svgElement(document, "circle", { cx: "12.25", cy: "9.25", r: "2.25" }),
  );
  return svg;
}

/** The features with a change the owner has not seen. */
function featuresWithUnseenChange(options: SettingsPanelOptions): Feature[] {
  return options.features.filter(
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

/** The count of unseen feature changes, on the settings button's corner. */
function unseenCountBadge(document: Document, unseenCount: number): HTMLElement {
  const badge = element(document, "span", { className: BADGE_CLASS, text: String(unseenCount) });
  badge.setAttribute("aria-label", `${unseenCount} new or updated`);
  return badge;
}

/** The top bar item, shaped like Azure DevOps's own icon buttons next to it. */
function createButtonItem(document: Document, open: () => void, unseenCount: number): HTMLElement {
  const item = element(document, "div", { className: `${BUTTON_ITEM_CLASS} flex-row flex-center` });
  item.setAttribute("role", "menuitem");
  const settingsButton = button(
    document,
    {
      className:
        "fix-ado-settings-button bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment",
    },
    open,
  );
  settingsButton.title = TITLE;
  settingsButton.setAttribute("aria-label", TITLE);
  settingsButton.append(puzzleIcon(document));
  if (unseenCount > 0) {
    settingsButton.append(unseenCountBadge(document, unseenCount));
  }
  item.append(settingsButton);
  return item;
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
  for (const feature of options.features) {
    const checkbox = dialog.querySelector<HTMLInputElement>(
      `input[data-feature-id="${feature.id}"]`,
    );
    if (checkbox && checkbox.checked !== options.isOn(feature)) {
      changed.set(feature.id, checkbox.checked);
    }
  }
  return changed;
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
    { className: "bolt-button enabled primary bolt-focus-treatment", text: "Save and reload" },
    () => {
      options.save(changedChoices(dialog, options));
      options.reload();
    },
  );
  save.disabled = true;
  const buttons = element(document, "div", { className: "fix-ado-settings-buttons" });
  buttons.append(cancel, save);
  return { buttons, save };
}

function featureList(options: SettingsPanelOptions, unseen: Feature[]): HTMLElement {
  const list = element(options.document, "div", { className: "fix-ado-settings-features" });
  list.append(
    ...options.features.map((feature) =>
      featureRow(options.document, {
        chip: unseen.includes(feature) ? chipKind(feature, options) : null,
        feature,
        isOn: options.isOn(feature),
      }),
    ),
  );
  return list;
}

function createDialog(options: SettingsPanelOptions, unseen: Feature[]): HTMLDialogElement {
  const { document } = options;
  const dialog = element(document, "dialog", { className: DIALOG_CLASS });
  dialog.setAttribute("aria-label", TITLE);
  const warning = element(document, "p", {
    className: "fix-ado-settings-warning",
    text: RELOAD_WARNING,
  });
  warning.setAttribute("role", "note");
  const { buttons, save } = createButtons(dialog, options);
  dialog.addEventListener("change", () => {
    save.disabled = changedChoices(dialog, options).size === 0;
  });
  dialog.append(
    element(document, "h2", { className: "fix-ado-settings-title", text: TITLE }),
    featureList(options, unseen),
    warning,
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
        topBar.prepend(createButtonItem(document, open, featuresWithUnseenChange(options).length));
      }
    },
  };
}

export type { SettingsPanel };
export { createSettingsPanel };
