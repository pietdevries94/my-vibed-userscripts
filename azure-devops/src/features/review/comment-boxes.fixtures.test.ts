import { findCommentBoxes, findLineRow } from "./comment-boxes.ts";
import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import type { CommentBox } from "./comment-boxes.ts";
import type { LineAnchor } from "./review-store.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const { skip } = fixtures;

/** The only comment box on a captured page, which must sit on a line. */
function lineBoxOf(page: string): { document: Document; box: CommentBox; anchor: LineAnchor } {
  const { document } = loadCapturedPullRequest(page);
  const [box, ...others] = findCommentBoxes(document);
  assert.deepEqual(others, []);
  assert.ok(box !== undefined && box.anchor.kind === "line");
  return { anchor: { ...box.anchor, iteration: null }, box, document };
}

function isBoxUnderItsLine(page: string): boolean {
  const { anchor, box, document } = lineBoxOf(page);
  return findLineRow(document, anchor)?.nextElementSibling?.contains(box.textarea) === true;
}

test("the box on an added line knows its file, its line and its side", { skip }, () => {
  const { anchor, box } = lineBoxOf("pr-files-composer");
  assert.equal(box.postButton.textContent, "Comment");
  assert.equal(box.cancelButton?.textContent, "Cancel");
  assert.equal(anchor.side, "right");
  assert.ok(anchor.line > 0);
  assert.ok(anchor.filePath.length > 0);
  assert.ok(isBoxUnderItsLine("pr-files-composer"));
});

test("the box on a removed line is on the left side", { skip }, () => {
  assert.equal(lineBoxOf("pr-files-composer-left").anchor.side, "left");
  assert.ok(isBoxUnderItsLine("pr-files-composer-left"));
});

test("the Overview's box is a comment on the pull request as a whole", { skip }, () => {
  const { document } = loadCapturedPullRequest("pr-detail-comment-open");
  assert.deepEqual(
    findCommentBoxes(document).map(({ anchor }) => anchor),
    [{ kind: "general" }],
  );
});

test("a reply box is left alone", { skip }, () => {
  for (const page of ["pr-files-reply-open"]) {
    assert.deepEqual(findCommentBoxes(loadCapturedPullRequest(page).document), [], page);
  }
});
