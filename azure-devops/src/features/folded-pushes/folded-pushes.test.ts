import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createFoldedPushes } from "./folded-pushes.ts";
import { test } from "node:test";

const COMMITS = `<div class="bolt-table-container"><table><tr><td>Fix the ledger total</td></tr></table></div>`;

function pushRow(time: string, commits = COMMITS): string {
  return `<tr class="bolt-timeline-row"><td>
    <div class="bolt-table-card bolt-card"><div class="bolt-card-content"><div class="flex-column">
      <a class="iteration-card-header" href="/fake-org/ledger/_git/ledger-api">
        <div class="flex-row iteration-header">
          <div><div class="bolt-coin" aria-label="Quill Barrow"></div></div>
          <div class="flex-column flex-grow">
            <span class="font-weight-semibold">Quill Barrow pushed 1 commit</span>
            <div class="body-s secondary-text"><time datetime="${time}">an hour ago</time></div>
          </div>
        </div>
      </a>
      ${commits}
    </div></div></div>
  </td></tr>`;
}

const FIRST_PUSH = "2031-03-04T09:00:00.000Z";
const SECOND_PUSH = "2031-03-04T10:30:00.000Z";

interface OverviewPage {
  document: Document;
  sync: () => void;
  states: () => (string | undefined)[];
  toggles: () => HTMLButtonElement[];
}

function overviewPage(rows: string): OverviewPage {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createFoldedPushes({ document });
  return {
    document,
    states: () =>
      [...document.querySelectorAll<HTMLElement>(".bolt-card")].map(
        (card) => card.dataset.fixAdoPush,
      ),
    sync,
    toggles: () => [...document.querySelectorAll<HTMLButtonElement>(".fix-ado-push-toggle")],
  };
}

test("every push starts folded, with a toggle after its title", () => {
  const page = overviewPage(pushRow(FIRST_PUSH) + pushRow(SECOND_PUSH));
  page.sync();
  assert.deepEqual(page.states(), ["folded", "folded"]);
  const [toggle] = page.toggles();
  assert.equal(page.toggles().length, 2);
  assert.equal(toggle?.getAttribute("aria-expanded"), "false");
  assert.equal(toggle?.title, "Show commits");
  assert.equal(toggle?.previousElementSibling?.textContent, "Quill Barrow pushed 1 commit");
});

test("a click on the toggle opens that push only, and a second click folds it", () => {
  const page = overviewPage(pushRow(FIRST_PUSH) + pushRow(SECOND_PUSH));
  page.sync();
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["folded", "open"]);
  assert.equal(page.toggles()[1]?.getAttribute("aria-expanded"), "true");
  assert.equal(page.toggles()[1]?.title, "Hide commits");
  page.toggles()[1]?.click();
  assert.deepEqual(page.states(), ["folded", "folded"]);
});

test("a click on the toggle does not follow the header's link", () => {
  const page = overviewPage(pushRow(FIRST_PUSH));
  page.sync();
  let isFollowed = false;
  page.document.querySelector(".iteration-card-header")?.addEventListener("click", () => {
    isFollowed = true;
  });
  const window = page.document.defaultView;
  assert.ok(window !== null);
  const click = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  page.toggles()[0]?.dispatchEvent(click);
  assert.equal(isFollowed, false);
  assert.equal(click.defaultPrevented, true);
});

test("a push without commits is folded and has no toggle", () => {
  const page = overviewPage(pushRow(FIRST_PUSH, ""));
  page.sync();
  assert.deepEqual(page.states(), ["folded"]);
  assert.equal(page.toggles().length, 0);
});

test("syncing again adds no second toggle", () => {
  const page = overviewPage(pushRow(FIRST_PUSH));
  page.sync();
  page.sync();
  assert.equal(page.toggles().length, 1);
});

test("an open push that Azure DevOps rendered again is open again", () => {
  const page = overviewPage(pushRow(FIRST_PUSH) + pushRow(SECOND_PUSH));
  page.sync();
  page.toggles()[0]?.click();
  const body = page.document.querySelector("tbody");
  assert.ok(body !== null);
  body.innerHTML = pushRow(SECOND_PUSH) + pushRow(FIRST_PUSH);
  page.sync();
  assert.deepEqual(page.states(), ["folded", "open"]);
});

test("a row reused for another push shows that push's state", () => {
  const page = overviewPage(pushRow(FIRST_PUSH));
  page.sync();
  page.toggles()[0]?.click();
  page.document.querySelector("time")?.setAttribute("datetime", SECOND_PUSH);
  page.sync();
  assert.deepEqual(page.states(), ["folded"]);
  assert.equal(page.toggles()[0]?.getAttribute("aria-expanded"), "false");
});
