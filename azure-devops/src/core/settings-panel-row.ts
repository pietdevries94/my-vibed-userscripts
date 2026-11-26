import type { Feature, FeatureChange } from "./feature.ts";
import { createSwitch, showSwitchOn } from "./switch.ts";
import { element } from "./settings-panel-markup.ts";

const CHIP_TEXT = { new: "New", updated: "Updated" } as const;

function chipElement(document: Document, text: string, kind: string): HTMLElement {
  return element(document, "span", {
    className: `fix-ado-settings-chip fix-ado-settings-chip-${kind}`,
    text,
  });
}

/** The feature's name, with a New or Updated chip while its change is unseen, then its tag. */
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
    name.append(chipElement(document, CHIP_TEXT[chip], chip));
  }
  if (feature.tag !== undefined) {
    name.append(chipElement(document, feature.tag, "tag"));
  }
  return name;
}

interface FeatureRowParts {
  feature: Feature;
  isOn: boolean;
  /** Null when the feature has no unseen change. */
  chip: FeatureChange["kind"] | null;
}

/** The feature's description. The switch reads it out as its description, not its name. */
function featureDescription(document: Document, feature: Feature): HTMLElement {
  const description = element(document, "span", {
    className: "fix-ado-settings-feature-description",
    text: feature.description,
  });
  description.id = `fix-ado-settings-description-${feature.id}`;
  description.setAttribute("aria-hidden", "true");
  return description;
}

/** A switch that fills the row: the feature's name and description, and the pill on the right. */
function featureRow(document: Document, { feature, isOn, chip }: FeatureRowParts): HTMLElement {
  const row = createSwitch(document, "");
  row.classList.add("fix-ado-settings-feature");
  row.dataset.featureId = feature.id;
  showSwitchOn(row, isOn);
  const description = featureDescription(document, feature);
  row.setAttribute("aria-describedby", description.id);
  row
    .querySelector(".fix-ado-switch-text")
    ?.replaceChildren(featureName(document, feature, chip), description);
  row.addEventListener("click", () => {
    showSwitchOn(row, row.getAttribute("aria-checked") !== "true");
  });
  return row;
}

/** Whether the row's switch is on. */
function isRowOn(row: Element): boolean {
  return row.getAttribute("aria-checked") === "true";
}

export { featureRow, isRowOn };
