import { KEY, NEWEST_ITERATION, loadReviewPage, settle } from "./review.test-page.ts";
import type { ReviewPage } from "./review.test-page.ts";
import assert from "node:assert/strict";
import { fixtures } from "../../pull-requests/captured-pull-request.test-page.ts";
import { test } from "node:test";

const { skip } = fixtures;
const CARD = ".fix-ado-review-card-row";

/** The open comment box of a captured page. */
function boxTextarea({ document }: ReviewPage): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[class*="threadId--"]:not([aria-hidden])',
  );
  assert.ok(textarea !== null);
  return textarea;
}

/** The all-files page with a comment on a line already in the review. */
async function pageWithReview(): Promise<ReviewPage> {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  await settle();
  page.button("Start a review").click();
  return page;
}

test(
  'a comment box gets "Start a review" after Azure DevOps\'s own button, which stays as it is',
  { skip },
  () => {
    const page = loadReviewPage("pr-files-composer");
    page.sync();
    page.sync();
    const labels = [...(page.button("Start a review").parentElement?.children ?? [])].map(
      (button) =>
        `${button.textContent}${button.classList.contains("primary") ? " (primary)" : ""}`,
    );
    assert.deepEqual(labels, ["Cancel", "Comment (primary)", "Start a review (primary)"]);
    assert.equal(page.document.querySelectorAll(".fix-ado-review-add").length, 1);
  },
);

test(
  '"Start a review" keeps the comment for the owner, closes the box and posts nothing',
  { skip },
  async () => {
    const page = loadReviewPage("pr-files-composer");
    page.sync();
    await settle();
    const textarea = boxTextarea(page);
    const typed = textarea.value;
    let cancels = 0;
    page.button("Cancel").addEventListener("click", () => {
      cancels += 1;
    });
    page.button("Start a review").click();

    const [comment] = page.store.pending(KEY);
    assert.equal(comment?.content, typed);
    assert.equal(comment.anchor?.iteration, NEWEST_ITERATION);
    assert.deepEqual([textarea.value, cancels, page.posted.length], ["", 1, 0]);
  },
);

test(
  "a pending comment shows as a card under its line, and in the tab bar's count",
  { skip },
  async () => {
    const page = await pageWithReview();
    const card = page.document.querySelector(CARD);
    const [comment] = page.store.pending(KEY);
    assert.ok(card !== null && comment?.anchor !== null && comment !== undefined);
    assert.equal(card.querySelector(".fix-ado-review-pending")?.textContent, "Pending");
    assert.equal(card.querySelector(".fix-ado-review-card-text")?.textContent, comment.content);
    // The capture's comment box is still open under the line. The card comes after it.
    const boxRow = card.previousElementSibling;
    assert.ok(boxRow?.querySelector(".repos-diff-discussion") !== null);
    const lineCell =
      boxRow?.previousElementSibling?.querySelector<HTMLElement>(".repos-line-content");
    assert.equal(lineCell?.dataset.mline, String(comment.anchor.line));
    const submit = page.document.querySelector(
      ".repos-pr-details-page-tabbar .fix-ado-review-header button",
    );
    assert.equal(submit?.textContent, "Submit review1");
    page.sync();
    assert.equal(page.document.querySelectorAll(CARD).length, 1);
  },
);

test(
  'in a started review the box reads "Add review comment", and Ctrl+Enter adds to the review',
  { skip },
  async () => {
    const page = await pageWithReview();
    const view = page.document.defaultView;
    assert.ok(view !== null);
    const textarea = boxTextarea(page);
    assert.equal(
      page.document.querySelector(".fix-ado-review-add")?.textContent,
      "Add review comment",
    );
    page.type(textarea, "A second remark");
    const key = new view.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "Enter",
    });
    textarea.dispatchEvent(key);
    assert.ok(key.defaultPrevented);
    assert.deepEqual(
      page.store
        .pending(KEY)
        .map(({ content }) => content)
        .slice(1),
      ["A second remark"],
    );
  },
);

test("cards on one line show in the order the comments were written", { skip }, async () => {
  const page = await pageWithReview();
  const [first] = page.store.pending(KEY);
  page.type(boxTextarea(page), "A second remark");
  page.button("Add review comment").click();
  page.sync();
  assert.deepEqual(
    [...page.document.querySelectorAll(`${CARD} .fix-ado-review-card-text`)].map(
      (text) => text.textContent,
    ),
    [first?.content, "A second remark"],
  );
});

test("without a review, Ctrl+Enter is left to Azure DevOps", { skip }, () => {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  const view = page.document.defaultView;
  assert.ok(view !== null);
  const key = new view.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    key: "Enter",
  });
  boxTextarea(page).dispatchEvent(key);
  assert.ok(!key.defaultPrevented);
  assert.deepEqual(page.store.pending(KEY), []);
});

test("the Overview's box adds a comment on the pull request, once it has text", { skip }, () => {
  const page = loadReviewPage("pr-detail-comment-open");
  page.sync();
  assert.ok(page.button("Start a review").disabled);
  page.type(boxTextarea(page), "Looks good overall.");
  assert.ok(!page.button("Start a review").disabled);
  page.button("Start a review").click();
  assert.deepEqual(
    page.store.pending(KEY).map(({ anchor, content }) => ({ anchor, content })),
    [{ anchor: null, content: "Looks good overall." }],
  );
});

test("a reply box gets no button", { skip }, () => {
  const page = loadReviewPage("pr-files-reply-open");
  page.sync();
  assert.equal(page.document.querySelector(".fix-ado-review-add"), null);
});

test("a card's text can be edited, and the comment deleted", { skip }, async () => {
  const page = await pageWithReview();
  page.button("Edit").click();
  const editor = page.document.querySelector<HTMLTextAreaElement>(`${CARD} textarea`);
  assert.ok(editor !== null);
  page.type(editor, "Better wording");
  page.button("Update comment").click();
  assert.equal(
    page.document.querySelector(`${CARD} .fix-ado-review-card-text`)?.textContent,
    "Better wording",
  );
  assert.equal(page.store.pending(KEY)[0]?.content, "Better wording");
  page.button("Delete comment").click();
  assert.deepEqual([page.store.pending(KEY), page.document.querySelector(CARD)], [[], null]);
  assert.equal(page.document.querySelector(".fix-ado-review-header"), null);
});

test('Azure DevOps\'s own post button is named "Add single comment", as it reads', { skip }, () => {
  const page = loadReviewPage("pr-files-composer");
  page.sync();
  const post = page.button("Start a review").previousElementSibling;
  assert.equal(post?.getAttribute("aria-label"), "Add single comment");
});

test(
  '"Finish your review" posts the summary, the comments and the vote, then reloads',
  { skip },
  async () => {
    const page = await pageWithReview();
    const [comment] = page.store.pending(KEY);
    page.document.querySelector<HTMLButtonElement>(".fix-ado-review-header button")?.click();
    const dialog = page.document.querySelector("dialog.fix-ado-review-dialog");
    const summary = dialog?.querySelector("textarea");
    assert.ok(dialog !== null && dialog !== undefined && summary !== null && summary !== undefined);
    page.type(summary, "Nice work.");
    [...dialog.querySelectorAll<HTMLInputElement>("input[type=radio]")][1]?.click();
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent === "Submit review")
      ?.click();
    await settle();
    assert.deepEqual(
      page.posted.map(({ content }) => content),
      ["Nice work.", comment?.content],
    );
    assert.deepEqual([page.votes, page.reloads.length, page.stored.has(KEY)], [[10], 1, false]);
  },
);

test(
  "on a completed pull request the review can only be copied or discarded",
  { skip },
  async () => {
    const page = loadReviewPage("pr-files-composer", "completed");
    page.store.add(KEY, { anchor: null, content: "Too late" });
    page.sync();
    await settle();
    const header = page.document.querySelector(".fix-ado-review-header");
    assert.deepEqual(
      [...(header?.children ?? [])].map((child) => child.textContent),
      ["1 pending comment", "Copy", "Discard"],
    );
    page.button("Copy").click();
    page.button("Discard").click();
    assert.deepEqual([page.copied, page.stored.has(KEY)], [["Too late"], false]);
  },
);
