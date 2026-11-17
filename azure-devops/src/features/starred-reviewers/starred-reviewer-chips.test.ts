import { attachPicker, page, pill } from "./starred-reviewer-chips.test-page.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createStarredReviewerChips } from "./starred-reviewer-chips.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import { onNextDomChange } from "../../core/next-dom-change.ts";
import { test } from "node:test";

const QUILL: Identity = {
  displayName: "Quill Barrow",
  id: "id-quill",
  isGroup: false,
  signInAddress: "quill@example.com",
};
const TEAM: Identity = {
  displayName: String.raw`[Ledger Works]\Ledger Team`,
  id: "id-team",
  isGroup: true,
  signInAddress: "",
};
const MARREN: Identity = {
  displayName: "Marren Tolk",
  id: "id-marren",
  isGroup: false,
  signInAddress: "marren@example.com",
};

interface Harness {
  document: Document;
  sync: () => void;
  /** Moves the clock one poll (250 ms) on, and runs what is due. */
  passPoll: () => void;
}

const POLL_MS = 250;

function setUp(starred: Identity[], html: string, isCreatePage = true): Harness {
  const { document } = new JSDOM(html).window;
  let now = 0;
  const scheduled: { callback: () => void; dueAt: number }[] = [];
  let saved = [...starred];
  const chips = createStarredReviewerChips({
    document,
    imageUrlOf: ({ id }) => `/avatars/${id}`,
    onNextDomChange: (callback) => onNextDomChange(document, callback),
    schedule: (callback, delayMs): (() => void) => {
      const entry = { callback, dueAt: now + delayMs };
      scheduled.push(entry);
      return () => {
        scheduled.splice(scheduled.indexOf(entry), 1);
      };
    },
    store: createStarredReviewersStore({
      load: () => saved,
      save: (list) => {
        saved = list;
      },
    }),
  });
  const harness: Harness = {
    document,
    passPoll: () => {
      now += POLL_MS;
      const due = scheduled
        .filter(({ dueAt }) => dueAt <= now)
        .toSorted((earlier, later) => earlier.dueAt - later.dueAt);
      for (const entry of due) {
        scheduled.splice(scheduled.indexOf(entry), 1);
        entry.callback();
      }
    },
    sync: () => {
      chips.sync(isCreatePage);
    },
  };
  harness.sync();
  return harness;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function chipRows(document: Document): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".fix-ado-starred-chips")];
}

function chipNames(row: Element | undefined): string[] {
  return [...(row?.querySelectorAll(".fix-ado-starred-chip .bolt-pill-content") ?? [])].map(
    (name) => name.textContent ?? "",
  );
}

function nameOfChip(button: Element): string {
  return button.querySelector(".bolt-pill-content")?.textContent ?? "";
}

function chip(row: Element | undefined, name: string): HTMLButtonElement {
  const buttons = [...(row?.querySelectorAll<HTMLButtonElement>(".fix-ado-starred-chip") ?? [])];
  const found = buttons.find((button) => nameOfChip(button) === name);
  assert.ok(found, `a chip for ${name}`);
  return found;
}

function pillNames(document: Document, labelId: string): string[] {
  return [
    ...document.querySelectorAll(`[aria-labelledby="${labelId}"] .bolt-identity-picker-pill`),
  ].map((pillElement) => pillElement.textContent?.trim() ?? "");
}

const OPTIONAL = "__bolt-pr-optional-reviewers-label";
const REQUIRED = "__bolt-pr-required-reviewers-label";

test("the starred reviewers show as chips under the Reviewers field, a team by its own name", () => {
  const { document } = setUp([QUILL, TEAM], page([], null));
  const rows = chipRows(document);
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0]?.parentElement,
    document.querySelector(`#${OPTIONAL}`)?.closest(".flex-column"),
  );
  assert.deepEqual(chipNames(rows[0]), ["Quill Barrow", "Ledger Team"]);
  assert.equal(rows[0]?.querySelector("img")?.getAttribute("src"), "/avatars/id-quill");
});

test("a starred reviewer already in a field gets no chip", () => {
  const { document } = setUp(
    [QUILL, TEAM, MARREN],
    page([pill("Ledger Team")], [pill("Quill Barrow")]),
  );
  for (const row of chipRows(document)) {
    assert.deepEqual(chipNames(row), ["Marren Tolk"]);
  }
});

test("with required reviewers on, the required field gets its own chips", () => {
  const { document } = setUp([QUILL], page([], []));
  const rows = chipRows(document);
  assert.equal(rows.length, 2);
  assert.equal(
    rows[1]?.parentElement,
    document.querySelector(`#${REQUIRED}`)?.closest(".flex-column"),
  );
});

test("no chips without starred reviewers, or on another page", () => {
  const withoutStarred = setUp([], page([], null));
  const elsewhere = setUp([QUILL], page([], null), false);
  assert.equal(chipRows(withoutStarred.document).length, 0);
  assert.equal(chipRows(elsewhere.document).length, 0);
});

test("syncing again leaves the same chips in place", () => {
  const { document, sync } = setUp([QUILL], page([], null));
  const before = chipRows(document)[0]?.querySelector(".fix-ado-starred-chip");
  sync();
  assert.equal(chipRows(document).length, 1);
  assert.equal(chipRows(document)[0]?.querySelector(".fix-ado-starred-chip"), before);
});

test("a click searches the field by sign-in address and picks that person", async () => {
  const harness = setUp([QUILL, MARREN], page([], []));
  attachPicker(harness.document, REQUIRED);
  const input = harness.document.querySelector<HTMLInputElement>(
    `input[aria-labelledby="${REQUIRED}"]`,
  );
  chip(chipRows(harness.document)[1], "Quill Barrow").click();
  assert.equal(input?.value, "quill@example.com");
  const busyChip = chip(chipRows(harness.document)[1], "Quill Barrow");
  assert.equal(busyChip.disabled, true);
  assert.ok(busyChip.querySelector(".fix-ado-spinner"), "the busy chip spins");
  assert.equal(busyChip.querySelector("img"), null, "in place of its avatar");
  assert.ok(
    harness.document.body.classList.contains("fix-ado-starred-picking"),
    "the page hides the field's dropdown while the chip picks",
  );
  await settle();
  harness.passPoll();
  assert.deepEqual(pillNames(harness.document, REQUIRED), ["Quill Barrow"]);
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), false);
  assert.deepEqual(pillNames(harness.document, OPTIONAL), []);
  harness.sync();
  for (const row of chipRows(harness.document)) {
    assert.deepEqual(chipNames(row), ["Marren Tolk"]);
  }
});

test("a click picks the reviewer as soon as the suggestions show, before a poll", async () => {
  const harness = setUp([QUILL], page([], null));
  attachPicker(harness.document, OPTIONAL);
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  await settle();
  assert.deepEqual(pillNames(harness.document, OPTIONAL), ["Quill Barrow"]);
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), false);
});

test("a team is searched by its own name", async () => {
  const harness = setUp([TEAM], page([], null));
  attachPicker(harness.document, OPTIONAL);
  chip(chipRows(harness.document)[0], "Ledger Team").click();
  await settle();
  harness.passPoll();
  assert.deepEqual(pillNames(harness.document, OPTIONAL), ["Ledger Team"]);
  assert.equal(chipRows(harness.document).length, 0);
});

test("the chip waits for the suggestions, and gives up when its reviewer is not among them", async () => {
  const harness = setUp([QUILL], page([], null));
  attachPicker(harness.document, OPTIONAL, {
    found: [{ detail: "quill.b@example.com", name: "Quill Barrows" }],
  });
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  harness.passPoll();
  await settle();
  for (let tries = 0; tries < 40; tries += 1) {
    harness.passPoll();
  }
  assert.deepEqual(pillNames(harness.document, OPTIONAL), []);
  const button = chip(chipRows(harness.document)[0], "Quill Barrow");
  assert.equal(button.disabled, false);
  assert.match(button.title, /not found/iu);
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), false);
});

test("a field that takes only the highlighted suggestion on Enter gets it on Enter", async () => {
  const harness = setUp([MARREN], page([], null));
  attachPicker(harness.document, OPTIONAL, { selectOn: "enter" });
  chip(chipRows(harness.document)[0], "Marren Tolk").click();
  await settle();
  harness.passPoll();
  harness.passPoll();
  assert.deepEqual(pillNames(harness.document, OPTIONAL), ["Marren Tolk"]);
});

test("Enter is not pressed when another suggestion is highlighted", async () => {
  const harness = setUp([QUILL], page([], null));
  attachPicker(harness.document, OPTIONAL, {
    found: [
      { detail: "team-quill@example.com", name: "Quill Barrows" },
      { detail: "quill@example.com", name: "Quill Barrow" },
    ],
    selectOn: "enter",
  });
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  await settle();
  for (let tries = 0; tries < 40; tries += 1) {
    harness.passPoll();
  }
  assert.deepEqual(pillNames(harness.document, OPTIONAL), []);
});

test("while one chip picks, the other chips are disabled and take no click", async () => {
  const harness = setUp([QUILL, MARREN], page([], null));
  attachPicker(harness.document, OPTIONAL);
  const input = harness.document.querySelector<HTMLInputElement>(
    `input[aria-labelledby="${OPTIONAL}"]`,
  );
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  const other = chip(chipRows(harness.document)[0], "Marren Tolk");
  assert.equal(other.disabled, true);
  assert.equal(other.querySelector(".fix-ado-spinner"), null, "only the picking chip spins");
  other.click();
  assert.equal(input?.value, "quill@example.com");
  await settle();
  harness.passPoll();
  assert.deepEqual(pillNames(harness.document, OPTIONAL), ["Quill Barrow"]);
  assert.equal(chip(chipRows(harness.document)[0], "Marren Tolk").disabled, false);
});

test("a pick still going after 5 seconds ends, and the page shows the field again", () => {
  const harness = setUp([QUILL], page([], null));
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  for (let polls = 0; polls < 19; polls += 1) {
    harness.passPoll();
  }
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), true);
  harness.passPoll();
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), false);
  const button = chip(chipRows(harness.document)[0], "Quill Barrow");
  assert.equal(button.disabled, false);
  assert.match(button.title, /not found/iu);
});

test("an error while picking ends the pick at once", () => {
  const harness = setUp([QUILL], page([], null));
  const input = harness.document.querySelector<HTMLInputElement>(
    `input[aria-labelledby="${OPTIONAL}"]`,
  );
  assert.ok(input);
  input.getAttribute = (): string => {
    throw new Error("the field changed");
  };
  chip(chipRows(harness.document)[0], "Quill Barrow").click();
  harness.passPoll();
  assert.equal(harness.document.body.classList.contains("fix-ado-starred-picking"), false);
  assert.equal(chip(chipRows(harness.document)[0], "Quill Barrow").disabled, false);
});
