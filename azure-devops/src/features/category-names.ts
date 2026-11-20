// The settings panel's headings, in its order: each names the place in Azure DevOps
// where its features show. script.json lists the script's features under them too.

const CATEGORY_NAMES = [
  "Pull request lists",
  "Pull request",
  "Pull request Overview",
  "Boards",
  "Everywhere",
] as const;

type CategoryName = (typeof CATEGORY_NAMES)[number];

export { CATEGORY_NAMES };
export type { CategoryName };
