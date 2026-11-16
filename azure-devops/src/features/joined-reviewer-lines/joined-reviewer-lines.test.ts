import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createJoinedReviewerLines } from "./joined-reviewer-lines.ts";
import { test } from "node:test";

function coin(name: string, className: string): string {
  return `<div aria-hidden="true"><div class="bolt-coin ${className}" aria-label="${name}"></div></div><span class="text-ellipsis">${name}</span>`;
}

interface LineWords {
  actor?: string;
  words?: string;
  ending?: string;
}

/** A line such as "Quill Barrow added Marren Tolk as a reviewer". */
function line(person: string, lineWords: LineWords = {}): string {
  const { actor = "Quill Barrow", words = "added", ending = "as a reviewer" } = lineWords;
  return `<tr class="bolt-timeline-row"><td><div role="heading">
    <div class="activity-card-subtle flex-row">${coin(actor, "activity-card-first-image")} ${words} ${coin(person, "margin-horizontal-8")} ${ending}</div>
    <div><time>an hour ago</time></div>
  </div></td></tr>`;
}

const added = (person: string): string => line(person);
const addedRequired = (person: string): string =>
  line(person, { ending: "as a required reviewer" });
const VOTE = `<tr class="bolt-timeline-row"><td><div role="heading">
    <div class="activity-card-subtle flex-row">${coin("Marren Tolk", "activity-card-first-image")} approved</div>
  </div></td></tr>`;

interface OverviewPage {
  document: Document;
  sync: () => void;
  /** The text of every line the feed shows, top to bottom. */
  shownLines: () => string[];
}

const textOf = (element: Element | null): string =>
  (element?.textContent ?? "").replaceAll(/\s+/gu, " ").trim();

function overviewPage(rows: string): OverviewPage {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createJoinedReviewerLines({ document });
  return {
    document,
    shownLines: () =>
      [...document.querySelectorAll<HTMLElement>("tr.bolt-timeline-row")]
        .filter((row) => row.dataset.fixAdoJoined !== "hidden")
        .map((row) =>
          textOf(
            row.querySelector(".fix-ado-joined-line") ?? row.querySelector(".activity-card-subtle"),
          ),
        ),
    sync,
  };
}

// Azure DevOps lists the newest line first.
test("lines next to each other that add a reviewer become one line, oldest reviewer first", () => {
  const page = overviewPage(added("Tessel Brook") + added("Marren Tolk"));
  page.sync();
  assert.deepEqual(page.shownLines(), [
    "Quill Barrow added Marren Tolk, Tessel Brook as a reviewer",
  ]);
});

test("the joined line shows each reviewer's avatar, and Azure DevOps's own line stays in the page, hidden", () => {
  const page = overviewPage(added("Tessel Brook") + added("Marren Tolk"));
  page.sync();
  const joined = page.document.querySelector(".fix-ado-joined-line");
  assert.deepEqual(
    [...(joined?.querySelectorAll(".bolt-coin") ?? [])].map((avatar) =>
      avatar.getAttribute("aria-label"),
    ),
    ["Quill Barrow", "Marren Tolk", "Tessel Brook"],
  );
  const [kept, hidden] = page.document.querySelectorAll<HTMLElement>("tr");
  assert.equal(kept?.dataset.fixAdoJoined, "line");
  assert.equal(hidden?.dataset.fixAdoJoined, "hidden");
  assert.equal(kept?.querySelectorAll(".activity-card-subtle").length, 2);
});

test("required and optional reviewers are grouped on the one line", () => {
  const page = overviewPage(
    added("Tessel Brook") + addedRequired("Odile Fenn") + added("Marren Tolk"),
  );
  page.sync();
  assert.deepEqual(page.shownLines(), [
    "Quill Barrow added Marren Tolk, Tessel Brook as a reviewer, Odile Fenn as a required reviewer",
  ]);
});

test("another line in between keeps the lines around it apart", () => {
  const page = overviewPage(added("Tessel Brook") + VOTE + added("Marren Tolk"));
  page.sync();
  assert.equal(page.shownLines().length, 3);
  assert.equal(page.document.querySelector(".fix-ado-joined-line"), null);
});

test("lines of different people, or with different words, are not joined", () => {
  const page = overviewPage(
    added("Tessel Brook") +
      line("Marren Tolk", { actor: "Odile Fenn" }) +
      line("Tessel Brook", { actor: "Odile Fenn", words: "removed" }),
  );
  page.sync();
  assert.equal(page.shownLines().length, 3);
});

test("syncing again changes nothing", () => {
  const page = overviewPage(added("Tessel Brook") + added("Marren Tolk"));
  page.sync();
  const joined = page.document.querySelector(".fix-ado-joined-line");
  page.sync();
  assert.deepEqual([...page.document.querySelectorAll(".fix-ado-joined-line")], [joined]);
});

test("a new line next to a joined one joins it", () => {
  const page = overviewPage(added("Tessel Brook") + added("Marren Tolk"));
  page.sync();
  page.document.querySelector("tbody")?.insertAdjacentHTML("afterbegin", added("Odile Fenn"));
  page.sync();
  assert.deepEqual(page.shownLines(), [
    "Quill Barrow added Marren Tolk, Tessel Brook, Odile Fenn as a reviewer",
  ]);
  assert.equal(page.document.querySelectorAll(".fix-ado-joined-line").length, 1);
});

test("a joined line whose neighbour is gone is Azure DevOps's own line again", () => {
  const page = overviewPage(added("Tessel Brook") + added("Marren Tolk"));
  page.sync();
  page.document.querySelectorAll("tr")[1]?.remove();
  page.sync();
  assert.deepEqual(page.shownLines(), ["Quill Barrow added Tessel Brook as a reviewer"]);
  assert.equal(page.document.querySelector("[data-fix-ado-joined]"), null);
  assert.equal(page.document.querySelector(".fix-ado-joined-line"), null);
});
