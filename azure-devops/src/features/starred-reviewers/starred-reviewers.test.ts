import {
  MARREN,
  QUILL,
  TEAM,
  isAdding,
  reviewerRow,
  section,
  setUp,
  settle,
  starredNames,
} from "./starred-reviewers.test-page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("without starred reviewers, the section under Optional explains what it is for", () => {
  const { document } = setUp([]);
  const starred = section(document);
  assert.equal(
    starred.previousElementSibling,
    document.querySelector(".pr-optional-reviewers-section"),
  );
  assert.match(starred.textContent ?? "", /Add starred as reviewer/u);
  assert.match(
    starred.querySelector(".repos-pr-no-items-well")?.textContent ?? "",
    /^Put people\/groups here you often add as pull requests/u,
  );
  assert.match(
    starred.querySelector(".fix-ado-star-someone")?.textContent ?? "",
    /Add person\/group to starred/u,
  );
});

test("lists starred reviewers that are not on the pull request yet, each with a + button", () => {
  const { document } = setUp([QUILL, MARREN, TEAM]);
  assert.deepEqual(starredNames(document), ["Marren Tolk"]);
  const row = section(document).querySelector(".fix-ado-starred-reviewer");
  assert.ok(row?.querySelector('.bolt-split-button [data-fix-ado-add="optional"]'));
  assert.ok(row?.querySelector('[data-fix-ado-add="required"]'));
  assert.equal(document.querySelector(".repos-pr-no-items-well"), null);
});

test("each reviewer row gets a star, filled for a starred reviewer", () => {
  const { document } = setUp([QUILL]);
  const stars = [
    ...document.querySelectorAll(".pr-required-reviewers-section .fix-ado-star"),
    ...document.querySelectorAll(".pr-optional-reviewers-section .fix-ado-star"),
  ];
  assert.deepEqual(
    stars.map((star) => star.getAttribute("aria-pressed")),
    ["true", "false"],
  );
  assert.equal(
    stars[0]?.nextElementSibling?.className,
    "repos-reviewer-reveal",
    "the star sits before the ⋮ button",
  );
});

test("a click on a row's star stars that reviewer, with the id from the pull request, and a second unstars", async () => {
  const harness = setUp([]);
  harness.document
    .querySelector<HTMLElement>(".pr-optional-reviewers-section .fix-ado-star")
    ?.click();
  await settle();
  assert.deepEqual(harness.saved, [TEAM]);
  // A second click unstars.
  harness.document
    .querySelector<HTMLElement>(".pr-optional-reviewers-section .fix-ado-star")
    ?.click();
  await settle();
  assert.deepEqual(harness.saved, []);
});

test("the + button adds the reviewer as optional, and spins in the row until Azure DevOps shows them", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  assert.equal(isAdding(harness.document), true, "the spinner takes the buttons' place at once");
  await settle();
  assert.deepEqual(harness.added, [{ isRequired: false, reviewerId: "id-marren" }]);
  assert.deepEqual(starredNames(harness.document), ["Marren Tolk"], "the row stays until then");
  assert.equal(isAdding(harness.document), true);
  harness.document
    .querySelector(".pr-optional-reviewers-section")
    ?.insertAdjacentHTML("beforeend", reviewerRow("Marren Tolk"));
  harness.sync();
  assert.deepEqual(starredNames(harness.document), []);
});

test("the page reloads when Azure DevOps does not show the added reviewer", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  harness.runScheduled();
  assert.equal(harness.reloads, 1);
});

test("no reload when Azure DevOps shows the added reviewer", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  harness.document
    .querySelector(".pr-optional-reviewers-section")
    ?.insertAdjacentHTML("beforeend", reviewerRow("Marren Tolk"));
  harness.sync();
  harness.runScheduled();
  assert.equal(harness.reloads, 0);
});

test("the required button adds the reviewer as required, and says so in its tooltip", async () => {
  const harness = setUp([MARREN]);
  const required = section(harness.document).querySelector<HTMLElement>(
    '[data-fix-ado-add="required"]',
  );
  assert.equal(required?.title, "Add as required reviewer");
  required?.click();
  await settle();
  assert.deepEqual(harness.added, [{ isRequired: true, reviewerId: "id-marren" }]);
});

test("a failed add keeps the row and says why", async () => {
  const harness = setUp([MARREN], {
    addPullRequestReviewer: async () => {
      throw new Error("HTTP 403");
    },
  });
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  assert.deepEqual(starredNames(harness.document), ["Marren Tolk"]);
  assert.equal(
    section(harness.document).querySelector(".fix-ado-starred-detail")?.textContent,
    "Could not add: HTTP 403",
  );
  assert.equal(isAdding(harness.document), false);
});

test("the star from a starred row unstars it", () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>(".fix-ado-star")?.click();
  assert.deepEqual(harness.saved, []);
  assert.ok(harness.document.querySelector(".fix-ado-starred-empty"));
});

test("a sync without changes leaves the list as it is", () => {
  const harness = setUp([MARREN]);
  const row = section(harness.document).querySelector(".fix-ado-starred-reviewer");
  harness.sync();
  assert.equal(section(harness.document).querySelector(".fix-ado-starred-reviewer"), row);
});

test("the search field finds people and groups to star, without the starred ones", async () => {
  const harness = setUp([QUILL]);
  const starred = section(harness.document);
  starred.querySelector<HTMLElement>(".fix-ado-star-someone")?.click();
  const input = starred.querySelector<HTMLInputElement>(".fix-ado-star-picker input");
  assert.ok(input);
  assert.equal(harness.document.activeElement, input);
  input.value = "ma";
  input.dispatchEvent(new (harness.document.defaultView?.Event ?? Event)("input"));
  harness.runScheduled();
  await settle();
  assert.deepEqual(harness.searched, ["ma"]);
  const suggestions = [...starred.querySelectorAll(".bolt-suggestions-item .fontSizeM")];
  assert.deepEqual(
    suggestions.map((name) => name.textContent),
    ["Marren Tolk"],
  );
  starred.querySelector<HTMLElement>(".bolt-suggestions-item")?.click();
  assert.deepEqual(harness.saved, [QUILL, MARREN]);
  assert.equal(starred.querySelector(".fix-ado-star-picker"), null, "the field closed");
  assert.deepEqual(starredNames(harness.document), ["Marren Tolk"]);
});

/** Opens the search field and types `query` into it. Every search finds Quill and Marren. */
async function searchFor(
  query: string,
  starredReviewers = [QUILL],
): Promise<{
  input: HTMLInputElement;
  key: (key: string) => void;
  starred: HTMLElement;
  type: (value: string) => void;
}> {
  const harness = setUp(starredReviewers);
  const starred = section(harness.document);
  starred.querySelector<HTMLElement>(".fix-ado-star-someone")?.click();
  const input = starred.querySelector<HTMLInputElement>(".fix-ado-star-picker input");
  assert.ok(input);
  const view = harness.document.defaultView;
  assert.ok(view !== null);
  const type = (value: string): void => {
    input.value = value;
    input.dispatchEvent(new view.Event("input"));
    harness.runScheduled();
  };
  type(query);
  await settle();
  return {
    input,
    key: (key) => {
      input.dispatchEvent(new view.KeyboardEvent("keydown", { key }));
    },
    starred,
    type,
  };
}

test("the arrow keys tell a screen reader which suggestion is highlighted", async () => {
  const { input, key, starred } = await searchFor("ma");
  const listbox = starred.querySelector(`#${input.getAttribute("aria-controls") ?? ""}`);
  assert.equal(listbox?.getAttribute("role"), "listbox");
  key("ArrowDown");
  const active = starred.querySelector(`#${input.getAttribute("aria-activedescendant") ?? ""}`);
  assert.equal(active?.getAttribute("role"), "option");
  assert.equal(active?.getAttribute("aria-selected"), "true");
  assert.match(active?.textContent ?? "", /Marren Tolk/u);
});

test("an emptied search field says its suggestions are closed", async () => {
  const { input, key, type } = await searchFor("ma");
  key("ArrowDown");
  type("");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(input.hasAttribute("aria-activedescendant"), false);
});

test("no matches is a polite status, not an option in the list", async () => {
  const { starred } = await searchFor("ma", [QUILL, MARREN]);
  const none = starred.querySelector(".bolt-suggestions-none-region");
  assert.equal(none?.getAttribute("role"), "status");
  assert.equal(none?.closest('[role="listbox"]'), null);
});
