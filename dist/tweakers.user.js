// ==UserScript==
// @name         Fix Tweakers
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.0.1
// @description  Trims the Tweakers homepage. Hides the lead story, the side columns, the top banner and the category bar.
// @match        https://tweakers.net/*
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/tweakers.user.js
// ==/UserScript==
"use strict";
(() => {
  // tweakers/src/news-only.ts
  var NEWS_ONLY_CLASS = "fix-tweakers-news-only";
  var HIDDEN_PARTS = [
    // "Vergelijk producten en prijzen" and its product categories, under the search bar.
    "#top > #categoryBar",
    // The banner above the content area.
    "#contentArea > .top-banner",
    // The lead story above the news item list.
    ".editorial-content > .ankeiler-large",
    // The side columns: the story stream, then promotions and Best Buy Guides.
    ".editorial-content > .ankeiler-stream",
    ".fp-grid-areas > .sidebar"
  ];
  function newsOnlyStyle() {
    let scope = `html.${NEWS_ONLY_CLASS}`;
    return `
${scope} :is(${HIDDEN_PARTS.join(", ")}) {
  display: none !important;
}
${scope} :is(.fp-grid-areas, .editorial-content) {
  display: block !important;
}
`;
  }
  function showNewsOnly(document2, location2) {
    document2.documentElement.classList.toggle(NEWS_ONLY_CLASS, location2.pathname === "/");
  }

  // tweakers/src/main.ts
  GM_addStyle(newsOnlyStyle());
  showNewsOnly(document, location);
})();
