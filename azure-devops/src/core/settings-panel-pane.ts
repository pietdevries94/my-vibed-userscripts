import type { Feature, FeatureChange, SettingsGroup, SettingsSection } from "./feature.ts";
import { element } from "./settings-panel-markup.ts";
import { featureRow } from "./settings-panel-row.ts";

const WHATS_NEW_NOTE = "Added or changed since you last opened this panel.";

/** What the pane shows: one section, by its index, or the features with an unseen change. */
type View = number | "whats-new";

interface RowEntry {
  feature: Feature;
  element: HTMLElement;
  /** Its name, description, section and group, in lower case, for search. */
  searchText: string;
}

interface GroupEntry {
  element: HTMLElement;
  rows: RowEntry[];
}

interface SectionEntry {
  element: HTMLElement;
  groups: GroupEntry[];
}

interface PaneOptions {
  document: Document;
  sections: SettingsSection[];
  isOn: (feature: Feature) => boolean;
  /** The chip a feature with an unseen change shows, or null for one without. */
  chip: (feature: Feature) => FeatureChange["kind"] | null;
}

interface Pane {
  element: HTMLElement;
  /** Shows the view, or the features that match the search when there is one. */
  show: (view: View, query: string) => void;
}

function rowEntry(section: SettingsSection, group: SettingsGroup, options: PaneOptions) {
  return (feature: Feature): RowEntry => ({
    element: featureRow(options.document, {
      chip: options.chip(feature),
      feature,
      isOn: options.isOn(feature),
    }),
    feature,
    searchText: [feature.name, feature.description, section.name, group.name ?? ""]
      .join(" ")
      .toLowerCase(),
  });
}

/** The group's name as a heading, when it has one, above a box of its features' rows. */
function groupEntry(section: SettingsSection, options: PaneOptions) {
  return (group: SettingsGroup): GroupEntry => {
    const { document } = options;
    const container = element(document, "div", { className: "fix-ado-settings-group" });
    if (group.name !== undefined) {
      container.append(
        element(document, "h4", { className: "fix-ado-settings-group-name", text: group.name }),
      );
    }
    const rows = group.features.map(rowEntry(section, group, options));
    const list = element(document, "div", { className: "fix-ado-settings-features" });
    list.append(...rows.map((row) => row.element));
    container.append(list);
    return { element: container, rows };
  };
}

/** A section's name as a heading, its description, then its groups. */
function sectionEntry(options: PaneOptions) {
  return (section: SettingsSection): SectionEntry => {
    const { document } = options;
    const container = element(document, "section", { className: "fix-ado-settings-section" });
    const groups = section.groups.map(groupEntry(section, options));
    container.append(
      element(document, "h3", { className: "fix-ado-settings-section-name", text: section.name }),
      element(document, "p", {
        className: "fix-ado-settings-section-description",
        text: section.description,
      }),
      ...groups.map((group) => group.element),
    );
    return { element: container, groups };
  };
}

/** Hides the rows that do not match, and each group left empty. Returns how many show. */
function showMatchingRows(section: SectionEntry, isMatch: RowMatch): number {
  let shown = 0;
  for (const group of section.groups) {
    let groupShown = 0;
    for (const row of group.rows) {
      row.element.hidden = isMatch !== null && !isMatch(row);
      groupShown += row.element.hidden ? 0 : 1;
    }
    group.element.hidden = groupShown === 0;
    shown += groupShown;
  }
  return shown;
}

/** Whether a row shows. Null when the pane shows one section whole. */
type RowMatch = ((row: RowEntry) => boolean) | null;

/** Search matches on any words in a row; without search, What's new shows the chipped rows. */
function rowMatchFor(view: View, query: string, options: PaneOptions): RowMatch {
  if (query !== "") {
    return (row: RowEntry): boolean => row.searchText.includes(query);
  }
  if (view === "whats-new") {
    return (row: RowEntry): boolean => options.chip(row.feature) !== null;
  }
  return null;
}

interface Notes {
  /** Above the rows: What's new's explanation, or the number of search results. */
  note: HTMLElement;
  /** Instead of rows, when the search matches nothing. */
  noMatch: HTMLElement;
}

function showNotes({ note, noMatch }: Notes, query: string, shown: number): void {
  note.textContent =
    query === "" ? WHATS_NEW_NOTE : `${shown} ${shown === 1 ? "setting" : "settings"}`;
  note.hidden = query !== "" && shown === 0;
  noMatch.textContent = `No setting matches “${query}”.`;
  noMatch.hidden = query === "" || shown > 0;
}

/** Shows the rows that match, or the section of the view. Returns how many rows show. */
function showSections(sections: SectionEntry[], view: View, isMatch: RowMatch): number {
  let shown = 0;
  for (const [index, section] of sections.entries()) {
    const sectionShown = showMatchingRows(section, isMatch);
    section.element.hidden = isMatch ? sectionShown === 0 : index !== view;
    shown += sectionShown;
  }
  return shown;
}

function createPane(options: PaneOptions): Pane {
  const { document } = options;
  const pane = element(document, "div", { className: "fix-ado-settings-pane" });
  const notes: Notes = {
    noMatch: element(document, "p", { className: "fix-ado-settings-no-match" }),
    note: element(document, "p", { className: "fix-ado-settings-view-note" }),
  };
  const sections = options.sections.map(sectionEntry(options));
  pane.append(notes.note, notes.noMatch, ...sections.map((section) => section.element));

  return {
    element: pane,
    show(view, query) {
      const isMatch = rowMatchFor(view, query, options);
      const shown = showSections(sections, view, isMatch);
      pane.classList.toggle("fix-ado-settings-pane-filtered", isMatch !== null);
      showNotes(notes, query, shown);
      if (isMatch === null) {
        notes.note.hidden = true;
      }
      pane.scrollTop = 0;
    },
  };
}

export type { View };
export { createPane };
