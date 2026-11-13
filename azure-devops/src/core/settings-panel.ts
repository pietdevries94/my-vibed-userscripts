import type { Feature } from "./feature.ts";

const TITLE = "Fix Azure DevOps settings";
const RELOAD_WARNING = "Saving reloads this page. Anything you typed and did not save is lost.";
const TOP_BAR_SELECTOR = ".region-header-menubar";
const BUTTON_ITEM_CLASS = "fix-ado-settings-item";
const DIALOG_CLASS = "fix-ado-settings";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

interface SettingsPanelOptions {
  document: Document;
  /** In the order the panel lists them. */
  features: Feature[];
  isOn: (feature: Feature) => boolean;
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

/** The top bar item, shaped like Azure DevOps's own icon buttons next to it. */
function createButtonItem(document: Document, open: () => void): HTMLElement {
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
  item.append(settingsButton);
  return item;
}

function featureRow(document: Document, feature: Feature, isOn: boolean): HTMLElement {
  const row = element(document, "label", { className: "fix-ado-settings-feature" });
  const checkbox = element(document, "input", { className: "fix-ado-settings-checkbox" });
  checkbox.type = "checkbox";
  checkbox.checked = isOn;
  checkbox.dataset.featureId = feature.id;
  const text = element(document, "span", { className: "fix-ado-settings-feature-text" });
  text.append(
    element(document, "span", { className: "fix-ado-settings-feature-name", text: feature.name }),
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

function featureList(options: SettingsPanelOptions): HTMLElement {
  const list = element(options.document, "div", { className: "fix-ado-settings-features" });
  list.append(
    ...options.features.map((feature) =>
      featureRow(options.document, feature, options.isOn(feature)),
    ),
  );
  return list;
}

function createDialog(options: SettingsPanelOptions): HTMLDialogElement {
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
    featureList(options),
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
    const dialog = createDialog(options);
    document.body.append(dialog);
    dialog.showModal();
  }

  return {
    open,
    sync() {
      const topBar = document.querySelector(TOP_BAR_SELECTOR);
      if (topBar && !topBar.querySelector(`.${BUTTON_ITEM_CLASS}`)) {
        topBar.prepend(createButtonItem(document, open));
      }
    },
  };
}

export type { SettingsPanel };
export { createSettingsPanel };
