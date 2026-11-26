import {
  BUTTON_ITEM_CLASS,
  SETTINGS_TITLE,
  createSettingsButtonItem,
  removeUnseenCountBadge,
} from "./settings-button.ts";
import type { Feature, FeatureChange, SettingsSection } from "./feature.ts";
import { button, element } from "./settings-panel-markup.ts";
import { createNav } from "./settings-panel-nav.ts";
import { createPane } from "./settings-panel-pane.ts";
import { isRowOn } from "./settings-panel-row.ts";

const TOP_BAR_SELECTOR = ".region-header-menubar";
const DIALOG_CLASS = "fix-ado-settings";
const TITLE_ID = "fix-ado-settings-title";

interface SettingsPanelOptions {
  document: Document;
  /** In the order the side bar lists them. */
  sections: SettingsSection[];
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

function allFeatures({ sections }: SettingsPanelOptions): Feature[] {
  return sections.flatMap((section) => section.groups.flatMap((group) => group.features));
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

/** The choices that differ from the stored ones, by feature id. */
function changedChoices(dialog: HTMLElement, options: SettingsPanelOptions): Map<string, boolean> {
  const changed = new Map<string, boolean>();
  for (const feature of allFeatures(options)) {
    const row = dialog.querySelector(`[data-feature-id="${feature.id}"]`);
    if (row && isRowOn(row) !== options.isOn(feature)) {
      changed.set(feature.id, isRowOn(row));
    }
  }
  return changed;
}

function changeCountText(count: number): string {
  if (count === 0) {
    return "";
  }
  return count === 1 ? "1 change" : `${count} changes`;
}

interface Footer {
  footer: HTMLElement;
  /** Shows the number of changed choices, and turns Save on when there are any. */
  showChanges: () => void;
}

function createFooter(dialog: HTMLDialogElement, options: SettingsPanelOptions): Footer {
  const { document } = options;
  const count = element(document, "span", { className: "fix-ado-settings-change-count" });
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
  const footer = element(document, "div", { className: "fix-ado-settings-buttons" });
  footer.append(count, cancel, save);
  return {
    footer,
    showChanges() {
      const changed = changedChoices(dialog, options).size;
      count.textContent = changeCountText(changed);
      save.disabled = changed === 0;
    },
  };
}

function panelTitle(document: Document): HTMLElement {
  const title = element(document, "h2", {
    className: "fix-ado-settings-title",
    text: SETTINGS_TITLE,
  });
  title.id = TITLE_ID;
  return title;
}

interface DialogParts {
  nav: HTMLElement;
  pane: HTMLElement;
  footer: HTMLElement;
}

/** The side bar and the pane next to each other, above the footer. */
function fillDialog(dialog: HTMLDialogElement, { nav, pane, footer }: DialogParts): void {
  const { ownerDocument } = dialog;
  const body = element(ownerDocument, "div", { className: "fix-ado-settings-body" });
  body.append(nav, pane);
  dialog.setAttribute("aria-labelledby", TITLE_ID);
  dialog.append(body, footer);
}

function createDialog(options: SettingsPanelOptions, unseen: Feature[]): HTMLDialogElement {
  const { document } = options;
  const dialog = element(document, "dialog", { className: DIALOG_CLASS });
  const pane = createPane({
    chip: (feature) => (unseen.includes(feature) ? chipKind(feature, options) : null),
    document,
    isOn: options.isOn,
    sections: options.sections,
  });
  const nav = createNav({
    document,
    onChange: () => {
      pane.show(nav.view(), nav.query());
    },
    sections: options.sections,
    title: panelTitle(document),
    unseenCount: unseen.length,
  });
  const { footer, showChanges } = createFooter(dialog, options);
  // A row switches itself on click; the dialog hears the click after it.
  dialog.addEventListener("click", showChanges);
  fillDialog(dialog, { footer, nav: nav.element, pane: pane.element });
  pane.show(nav.view(), "");
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
      removeUnseenCountBadge(document);
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
