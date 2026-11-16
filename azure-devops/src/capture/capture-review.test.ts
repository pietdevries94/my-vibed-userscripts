import assert from "node:assert/strict";
import { createPseudonyms } from "../../../shared/dev/scrub/pseudonyms.ts";
import { reviewResponsesOf } from "./capture-review.ts";
import { rules } from "./capture-rules.ts";
import { scrubJson } from "../../../shared/dev/scrub/scrub-json.ts";
import { test } from "node:test";

// Invented values that play the real ones. None of them may reach a capture file.
const PROJECT = "Ledger Works";
const PERSON = "Quill Barrow";
const THREAD_ID = 48_213;
const PULL_REQUEST = { project: PROJECT, pullRequestId: 4711, repository: "ledger-api" };
const HTTP_FORBIDDEN = 403;

const INLINE_THREAD = {
  comments: [
    { author: { displayName: PERSON }, commentType: "text", content: `Ask ${PERSON}`, id: 1 },
    { commentType: "text", content: "Done", id: 2, parentCommentId: 1 },
  ],
  id: THREAD_ID,
  isDeleted: false,
  properties: { CodeReviewThreadType: { $type: "System.String", $value: "VoteUpdate" } },
  pullRequestThreadContext: {
    changeTrackingId: 3,
    iterationContext: { firstComparingIteration: 1, secondComparingIteration: 2 },
  },
  status: "active",
  threadContext: {
    filePath: `/${PROJECT}/totals.ts`,
    rightFileEnd: { line: 14, offset: 9 },
    rightFileStart: { line: 12, offset: 1 },
  },
};
const ITERATIONS = [
  { author: { displayName: PERSON }, id: 1, reason: "push" },
  { id: 2, reason: "forcePush" },
];
const CHANGES = {
  changeEntries: [
    { changeId: 3, changeTrackingId: 3, changeType: "edit", item: { path: `/${PROJECT}/a.ts` } },
  ],
};

function respond(url: string): Response {
  if (url.includes("/iterations/2/changes?")) {
    return Response.json(CHANGES);
  }
  if (url.includes("/iterations?")) {
    return Response.json({ value: ITERATIONS });
  }
  return Response.json({ value: [INLINE_THREAD] });
}

async function capture(respondTo: (url: string) => Response): Promise<{
  urls: string[];
  scrubbed: string;
}> {
  const urls: string[] = [];
  const responses = await reviewResponsesOf(
    {
      apiBasePath: "/quillfield",
      fetch: async (url) => {
        urls.push(url);
        return respondTo(url);
      },
      origin: "https://dev.azure.com",
    },
    PULL_REQUEST,
  );
  return { scrubbed: JSON.stringify(scrubJson(responses, rules, createPseudonyms())), urls };
}

test("a pull request's threads, iterations and newest changes are captured with GET requests", async () => {
  const { urls } = await capture(respond);
  const pullRequestUrl =
    "https://dev.azure.com/quillfield/Ledger%20Works/_apis/git/repositories/ledger-api/pullRequests/4711";
  assert.deepEqual(urls, [
    `${pullRequestUrl}/threads?api-version=7.1`,
    `${pullRequestUrl}/iterations?api-version=7.1`,
    `${pullRequestUrl}/iterations/2/changes?api-version=7.1`,
    `${pullRequestUrl}/threads?$iteration=2&api-version=7.1`,
  ]);
});

test("a captured thread keeps where it sits and drops its text, file and people", async () => {
  const { scrubbed } = await capture(respond);
  assert.match(scrubbed, /"rightFileEnd":\{"line":14,"offset":9\}/u);
  assert.match(scrubbed, /"rightFileStart":\{"line":12,"offset":1\}/u);
  assert.match(scrubbed, /"changeTrackingId":3/u);
  assert.match(scrubbed, /"firstComparingIteration":1,"secondComparingIteration":2/u);
  assert.match(scrubbed, /"commentType":"text"[^}]*"id":2,"parentCommentId":1/u);
  assert.match(scrubbed, /"\$value":"VoteUpdate"/u);
  assert.match(scrubbed, /"isDeleted":false/u);
  assert.match(scrubbed, /"id":2,"reason":"forcePush"/u);
  assert.match(scrubbed, /"changeType":"edit"/u);
  for (const value of [PROJECT, PERSON, String(THREAD_ID), "totals", "Done"]) {
    assert.ok(!scrubbed.includes(value), `a real value is in the capture: ${value}`);
  }
});

test("a refused request keeps its HTTP status, and no iteration means no further request", async () => {
  const { scrubbed, urls } = await capture(() => new Response("", { status: HTTP_FORBIDDEN }));
  assert.equal(urls.length, 2);
  assert.match(scrubbed, /"threads":\{"body":null,"httpStatus":403\}/u);
  assert.match(scrubbed, /"newestIterationChanges":null/u);
});
