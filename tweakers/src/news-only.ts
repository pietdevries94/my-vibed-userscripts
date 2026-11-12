// On the homepage, hides the category bar, the top banner, the lead story and the side columns, so the news item list fills the content area.

/** On `<html>` while the homepage shows the news-only view. */
const NEWS_ONLY_CLASS = "fix-tweakers-news-only";

const NEWS_ITEM_LIST = "#headlines-start";

/** The homepage parts the news-only class hides. */
const HIDDEN_PARTS = [
  // "Vergelijk producten en prijzen" and its product categories, under the search bar.
  "#top > #categoryBar",
  // The banner above the content area.
  "#contentArea > .top-banner",
  // The lead story above the news item list.
  ".editorial-content > .ankeiler-large",
  // The side columns: the story stream, then promotions and Best Buy Guides.
  ".editorial-content > .ankeiler-stream",
  ".fp-grid-areas > .sidebar",
];

/** Hides the parts, and turns the homepage grids into one column, so the news item list takes the freed width. */
function newsOnlyStyle(): string {
  const scope = `html.${NEWS_ONLY_CLASS}`;
  return `
${scope} :is(${HIDDEN_PARTS.join(", ")}) {
  display: none !important;
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
