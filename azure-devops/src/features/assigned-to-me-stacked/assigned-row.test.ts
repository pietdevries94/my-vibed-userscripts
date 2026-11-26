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

/** A site row with two reviewers, the first of whom approved. */
function siteRowWithReviewers(): HTMLElement {
  const row = siteRow();
  const coin = `<div><div class="bolt-coin"><img src=""></div></div>`;
  const approved = `<span class="fluent-icons-enabled"><span aria-hidden="true" class="repos-pr-reviewer-vote absolute approved flex-noshrink fabric-icon ms-Icon--CompletedSolid"></span></span>`;
  row.insertAdjacentHTML(
    "beforeend",
    `<div class="rhythm-horizontal-8">
      <div class="pr-reviewer relative">${coin}${approved}</div>
      <div class="pr-reviewer relative">${coin}</div>
    </div>`,
  );
  return row;
}

test("each reviewer shows their own vote, as the site's icon", () => {
  const row = buildAssignedRow(
    siteRowWithReviewers(),
    {
      pullRequestId: 34,
      reviewers: [
        { displayName: "Vale, Juniper", vote: -5 },
        { displayName: "Holt, Mira", vote: 0 },
        { displayName: "Reed, Tamsin", vote: -10 },
      ],
    },
    { basePath: "/my-org", now: 0, reviewerId: "kestrel" },
  );

  const votes = [...(row?.querySelectorAll(".pr-reviewer") ?? [])].map(
    (reviewer) => reviewer.querySelector(".repos-pr-reviewer-vote")?.className ?? "",
  );
  assert.deepEqual(votes, [
    "repos-pr-reviewer-vote absolute waiting flex-noshrink fabric-icon ms-Icon--AwayStatus",
    "",
    "repos-pr-reviewer-vote absolute rejected flex-noshrink fabric-icon ms-Icon--StatusErrorFull",
  ]);
});

test("the comments cell shows the pull request's own count, not the template's", () => {
  const template = siteRow();
  template.insertAdjacentHTML(
    "beforeend",
    `<div aria-colindex="4"><div class="bolt-table-cell-content"><span class="repos-pr-list-comment-count">9</span></div></div>`,
  );

  const row = buildAssignedRow(
    template,
    { comments: { active: 1, total: 4 }, pullRequestId: 34 },
    { basePath: "/my-org", now: 0, reviewerId: "kestrel" },
  );

  assert.equal(row?.querySelector('[aria-colindex="4"]')?.textContent, "1/4");
});
