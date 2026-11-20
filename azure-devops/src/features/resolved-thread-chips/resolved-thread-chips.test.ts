import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createResolvedThreadChips } from "./resolved-thread-chips.ts";
import { test } from "node:test";

function comment(author: string, status: string | null): string {
  const statusDropdown =
    status === null
      ? ""
      : `<div class="bolt-dropdown-expandable"><button><div class="bolt-dropdown-expandable-button-label">${status}</div></button></div>`;
  return `<div class="repos-comment-viewer"><div class="repos-discussion-comment-header flex-row">
    <div class="scroll-hidden flex-row flex-center"><span>${author}</span><div><time>an hour ago</time></div></div>
    <div class="flex-row justify-end">${statusDropdown}</div>
  </div><p>Should the total include tax?</p></div>`;
}

/** A thread of two comments. Only the first comment has the status dropdown. */
function thread(status: string): string {
  return `<tr class="bolt-timeline-row"><td><div class="repos-discussion-thread">
    ${comment("Quill Barrow", status)}${comment("Marren Tolk", null)}
  </div></td></tr>`;
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  /** Per thread, the text of its chips. */
  chips: () => string[][];
}

function overviewPage(rows: string): OverviewPage {
  const html = `<table class="activity-feed-list"><tbody>${rows}</tbody></table>`;
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const { sync } = createResolvedThreadChips({ document });
  return {
    chips: () =>
      [...document.querySelectorAll(".repos-discussion-thread")].map((shown) =>
        [...shown.querySelectorAll(".fix-ado-thread-chip")].map((chip) => chip.textContent),
      ),
    document,
    sync,
  };
}

test("every thread with a status gets a chip with that status as its text", () => {
  const page = overviewPage(
    thread("Resolved") +
      thread("Active") +
      thread("Pending") +
      thread("Won’t fix") +
      thread("Parked") +
      thread(""),
  );
  page.sync();
  assert.deepEqual(page.chips(), [
    ["Resolved"],
    ["Active"],
    ["Pending"],
    ["Won’t fix"],
    ["Parked"],
    [],
  ]);
});

test("a chip's class gives its colour: resolved, active or pending, or another done status", () => {
  const page = overviewPage(
    thread("Resolved") + thread("Active") + thread("Pending") + thread("Parked"),
  );
  page.sync();
  const classOf = (className: string): number =>
    page.document.querySelectorAll(`.${className}`).length;
  assert.equal(classOf("fix-ado-resolved-chip"), 1);
  assert.equal(classOf("fix-ado-unresolved-chip"), 2);
  assert.equal(classOf("fix-ado-done-chip"), 1);
});

test("the chip sits after the time of the first comment", () => {
  const page = overviewPage(thread("Resolved"));
  page.sync();
  const chip = page.document.querySelector(".fix-ado-thread-chip");
  assert.equal(chip?.previousElementSibling?.tagName, "TIME");
  assert.equal(chip?.closest(".repos-comment-viewer")?.previousElementSibling, null);
});

test("syncing again adds no second chip", () => {
  const page = overviewPage(thread("Resolved"));
  page.sync();
  page.sync();
  assert.deepEqual(page.chips(), [["Resolved"]]);
});

test("a thread whose status changes gets the chip of its new status", () => {
  const page = overviewPage(thread("Resolved"));
  page.sync();
  const status = page.document.querySelector(".bolt-dropdown-expandable-button-label");
  assert.ok(status !== null);
  status.textContent = "Active";
  page.sync();
  assert.deepEqual(page.chips(), [["Active"]]);
  status.textContent = "Parked";
  page.sync();
  assert.deepEqual(page.chips(), [["Parked"]]);
  status.textContent = "";
  page.sync();
  assert.deepEqual(page.chips(), [[]]);
  status.textContent = "Resolved";
  page.sync();
  assert.deepEqual(page.chips(), [["Resolved"]]);
});
