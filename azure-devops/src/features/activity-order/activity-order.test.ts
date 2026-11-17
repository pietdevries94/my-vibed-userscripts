import type { ActivityOrder } from "./activity-order.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createActivityOrder } from "./activity-order.ts";
import { test } from "node:test";

const OVERVIEW = `
  <div class="flex-row flex-wrap justify-end">
    <div class="bolt-dropdown-expandable"><button>Show everything</button></div>
    <div class="repos-activity-filter-dropdown"><button>All</button></div>
  </div>
  <table class="activity-feed-list"><tbody>
    <tr class="bolt-timeline-row bolt-timeline-first-row"><td>Add a comment</td></tr>
    <tr class="bolt-timeline-row"><td>Quill Barrow approved</td></tr>
    <tr class="bolt-timeline-row bolt-timeline-last-row"><td>Marren Tolk created the pull request</td></tr>
  </tbody></table>`;

interface OverviewPage {
  document: Document;
  saved: ActivityOrder[];
  sync: () => void;
  button: () => HTMLButtonElement;
  shownOrder: () => string | undefined;
}

function overviewPage(stored: ActivityOrder | null = null, html = OVERVIEW): OverviewPage {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const saved: ActivityOrder[] = [];
  const { sync } = createActivityOrder({
    document,
    storage: {
      load: () => stored,
      save: (order) => {
        saved.push(order);
      },
    },
  });
  return {
    button: () => {
      const button = document.querySelector<HTMLButtonElement>(".fix-ado-activity-order");
      assert.ok(button !== null, "the sort button is there");
      return button;
    },
    document,
    saved,
    shownOrder: () =>
      document.querySelector<HTMLElement>(".activity-feed-list")?.dataset.fixAdoActivityOrder,
    sync,
  };
}

test("the activity feed runs oldest first until the owner picks an order", () => {
  const page = overviewPage();
  page.sync();
  assert.equal(page.shownOrder(), "oldest-first");
  assert.equal(page.button().textContent, "Oldest first");
  assert.equal(page.button().title, "Show newest first");
});

test("the sort button sits before the filters", () => {
  const page = overviewPage();
  page.sync();
  const filters = page.document.querySelector(".repos-activity-filter-dropdown")?.parentElement;
  assert.equal(filters?.firstElementChild, page.button().parentElement);
});

test("the sort button is spaced like the filters, grey, with an icon before its label", () => {
  const page = overviewPage();
  page.sync();
  const button = page.button();
  assert.deepEqual(
    [...(button.parentElement?.classList ?? [])].filter((name) => name.startsWith("margin-")),
    ["margin-bottom-16", "margin-right-8"],
  );
  assert.ok(!button.classList.contains("subtle"));
  assert.equal(button.firstElementChild?.tagName, "svg");
  assert.equal(button.firstElementChild?.getAttribute("aria-hidden"), "true");
  assert.equal(button.lastElementChild?.textContent, "Oldest first");
});

test("a click flips the order and saves it", () => {
  const page = overviewPage();
  page.sync();
  page.button().click();
  assert.equal(page.shownOrder(), "newest-first");
  assert.equal(page.button().textContent, "Newest first");
  assert.equal(page.button().title, "Show oldest first");
  page.button().click();
  assert.equal(page.shownOrder(), "oldest-first");
  assert.deepEqual(page.saved, ["newest-first", "oldest-first"]);
});

test("a saved order is shown", () => {
  const page = overviewPage("newest-first");
  page.sync();
  assert.equal(page.shownOrder(), "newest-first");
  assert.equal(page.button().textContent, "Newest first");
});

test("syncing again adds no second button", () => {
  const page = overviewPage();
  page.sync();
  page.sync();
  assert.equal(page.document.querySelectorAll(".fix-ado-activity-order").length, 1);
});

test("a feed that Azure DevOps rendered again gets the order and the button back", () => {
  const page = overviewPage();
  page.sync();
  page.button().click();
  page.document.body.innerHTML = OVERVIEW;
  page.sync();
  assert.equal(page.shownOrder(), "newest-first");
  assert.equal(page.button().textContent, "Newest first");
});

test("a page without an activity feed gets no button", () => {
  const page = overviewPage(null, `<div class="repos-pr-description-card"></div>`);
  page.sync();
  assert.equal(page.document.querySelector(".fix-ado-activity-order"), null);
});

/** How often the page heard Ctrl+Alt+V, Azure DevOps's key that renders every row of a list. */
function renderAllPresses(document: Document): () => number {
  let presses = 0;
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.altKey && event.key === "v") {
      presses += 1;
    }
  });
  return () => presses;
}

test("a feed shown oldest first has Azure DevOps render all its rows, once", () => {
  const page = overviewPage();
  const presses = renderAllPresses(page.document);
  page.sync();
  page.sync();
  assert.equal(presses(), 1);
});

test("a feed shown newest first keeps Azure DevOps's partial rendering until it flips", () => {
  const page = overviewPage("newest-first");
  const presses = renderAllPresses(page.document);
  page.sync();
  assert.equal(presses(), 0);
  page.button().click();
  page.button().click();
  assert.equal(presses(), 1);
});

test("a feed that Azure DevOps rendered again has all its rows rendered again", () => {
  const page = overviewPage();
  const presses = renderAllPresses(page.document);
  page.sync();
  page.document.body.innerHTML = OVERVIEW;
  page.sync();
  assert.equal(presses(), 2);
});
