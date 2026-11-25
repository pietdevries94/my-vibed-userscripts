import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { buildAssignedRow } from "./assigned-row.ts";
import { test } from "node:test";

/** A site row whose line under the title is several text nodes, as React renders it. */
function siteRow(): HTMLElement {
  const { document } = new JSDOM("<!doctype html><body><table><tbody></tbody></table></body>")
    .window;
  const row = document.createElement("a");
  row.className = "bolt-table-row";
  row.setAttribute("href", "/my-org/my-project/_git/my-repo/pullrequest/12");
  row.innerHTML = `<div aria-colindex="1"><div class="bolt-coin" aria-label="Holt, Mira"><img src=""></div></div>
    <div><div class="bolt-table-two-line-cell-item"><div class="body-l">Old title</div></div>
    <div class="bolt-table-two-line-cell-item"><div class="secondary-text"><span></span></div></div></div>`;
  row.querySelector(".secondary-text > span")?.append("Holt, Mira", " request !", "12", " into ");
  document.querySelector("tbody")?.append(row);
  return row;
}

test("the line under the title names the pull request's author and id, in split text too", () => {
  const row = buildAssignedRow(
    siteRow(),
    { createdBy: { displayName: "Vale, Juniper" }, pullRequestId: 34, title: "New title" },
    { basePath: "/my-org", now: 0, reviewerId: "kestrel" },
  );

  assert.equal(
    row?.querySelector(".secondary-text")?.textContent,
    "Vale, Juniper request !34 into ",
  );
  assert.equal(row?.querySelector(".body-l")?.textContent, "New title");
});
