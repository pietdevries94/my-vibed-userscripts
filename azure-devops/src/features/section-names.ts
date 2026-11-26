// The settings panel's sections, in its side bar's order. script.json lists the script's
// features under them too. Its own file, so tests read the names without loading features.

const SECTION_NAMES = [
  "General",
  "Appearance",
  "Pull request lists",
  "Comments and activity",
  "Code review",
  "Pipelines",
  "Boards",
] as const;

type SectionName = (typeof SECTION_NAMES)[number];

export { SECTION_NAMES };
export type { SectionName };
