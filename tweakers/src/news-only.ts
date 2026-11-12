// On the homepage, hides everything but the news item list.

/** On `<html>` while the homepage shows only the news item list. */
const NEWS_ONLY_CLASS = "fix-tweakers-news-only";

const NEWS_ITEM_LIST = "#headlines-start";

/** The homepage parts the news-only class hides. */
const HIDDEN_PARTS = [
  // The site header: menu bar, alert bar, search bar and category bar.
  "#top",
  "#contentArea > .top-banner",
  // The lead story above the news item list.
  ".editorial-content > .ankeiler-large",
  // The side columns: the story stream, then promotions and Best Buy Guides.
  ".editorial-content > .ankeiler-stream",
  ".fp-grid-areas > .sidebar",
  ".fp-grid-areas > .community-block",
  // The tracker tabs and their pane at the right edge.
  "twk-sidebar",
  "twk-sidebar-pane",
  "#bottom",
];

/** Hides the parts, and turns the homepage grids into one column for the news item list. */
function newsOnlyStyle(): string {
  const scope = `html.${NEWS_ONLY_CLASS}`;
  return `
${scope} :is(${HIDDEN_PARTS.join(", ")}) {
  display: none !important;
}
${scope} body {
  margin-right: 0 !important;
}
${scope} :is(.fp-grid-areas, .editorial-content) {
  display: block !important;
}
`;
}

function showNewsOnly(document: Document, location: Location): void {
  document.documentElement.classList.toggle(NEWS_ONLY_CLASS, location.pathname === "/");
}

export { HIDDEN_PARTS, NEWS_ITEM_LIST, NEWS_ONLY_CLASS, newsOnlyStyle, showNewsOnly };
