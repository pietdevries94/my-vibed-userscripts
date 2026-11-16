import type { NewThread, PullRequestThread } from "../../pull-requests/review-requests.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import type { TestReviewStore } from "./review-store.test-page.ts";
import assert from "node:assert/strict";
import { createTestReviewStore } from "./review-store.test-page.ts";
import { submitReview } from "./review-submit.ts";
import { test } from "node:test";

const KEY = "review:dev.azure.com/quillfield/Ledger Works/ledger-api/4711";
const PULL_REQUEST = { project: "Ledger Works", pullRequestId: 4711, repository: "ledger-api" };
const TOTALS = {
  filePath: "/src/totals.ts",
  iteration: 2,
  line: 12,
  lineLength: 30,
  side: "right",
} as const;
const REMOVED = {
  filePath: "/src/old.ts",
  iteration: null,
  line: 4,
  lineLength: 8,
  side: "left",
} as const;
const HTTP_FORBIDDEN = 403;
const FIRST_THREAD_ID = 100;
const NEWEST_ITERATION = 3;

interface FakeAdo {
  /** The comments Azure DevOps refuses, by their text. */
  failPosts: Set<string>;
  posted: NewThread[];
  threads: PullRequestThread[];
  votes: { reviewerId: string; vote: number }[];
  requests: string[];
}

type SubmitOptions = Parameters<typeof submitReview>[0];

interface Submit extends TestReviewStore {
  options: SubmitOptions;
  progress: string[];
}

function fakeClient(fake: FakeAdo): SubmitOptions["client"] {
  return {
    createPullRequestThread: async (_pullRequest, thread) => {
      fake.requests.push("post");
      if (fake.failPosts.has(thread.content)) {
        throw new AdoRequestError(HTTP_FORBIDDEN, null);
      }
      fake.posted.push(thread);
      return FIRST_THREAD_ID + fake.posted.length;
    },
    getAuthenticatedUserId: async () => "id-me",
    getIterationChanges: async (_pullRequest, iteration) => {
      fake.requests.push(`changes ${iteration}`);
      return [
        { changeTrackingId: 5, item: { path: "/src/totals.ts" } },
        { changeTrackingId: 6, item: { path: "/src/other.ts" } },
      ];
    },
    getPullRequestIterationIds: async () => [1, 2, NEWEST_ITERATION],
    getPullRequestThreads: async () => {
      fake.requests.push("threads");
      return fake.threads;
    },
    setPullRequestVote: async (_pullRequest, vote) => {
      fake.votes.push(vote);
    },
  };
}

function createSubmit(fake: FakeAdo): Submit {
  const testStore = createTestReviewStore();
  const progress: string[] = [];
  const options: SubmitOptions = {
    client: fakeClient(fake),
    key: KEY,
    onProgress: (handled, total) => {
      progress.push(`${handled}/${total}`);
    },
    pullRequest: PULL_REQUEST,
    store: testStore.store,
  };
  return { options, progress, ...testStore };
}

const createFake = (): FakeAdo => ({
  failPosts: new Set(),
  posted: [],
  requests: [],
  threads: [],
  votes: [],
});

test("every pending comment is posted in order, then the vote, and the review is deleted", async () => {
  const fake = createFake();
  const { options, progress, store, stored } = createSubmit(fake);
  store.add(KEY, { anchor: TOTALS, content: "Why not sum here?" });
  store.add(KEY, { anchor: REMOVED, content: "Why remove this?" });
  store.add(KEY, { anchor: null, content: "General remark" });

  const result = await submitReview(options, { summary: " Nice work. ", vote: 5 });

  assert.deepEqual(result, { failures: [], vote: "sent" });
  assert.deepEqual(fake.posted, [
    { content: "Nice work." },
    {
      content: "Why not sum here?",
      iteration: { changeTrackingId: 5, id: 2 },
      threadContext: {
        filePath: "/src/totals.ts",
        rightFileEnd: { line: 12, offset: 31 },
        rightFileStart: { line: 12, offset: 1 },
      },
    },
    {
      content: "Why remove this?",
      threadContext: {
        filePath: "/src/old.ts",
        leftFileEnd: { line: 4, offset: 9 },
        leftFileStart: { line: 4, offset: 1 },
      },
    },
    { content: "General remark" },
  ]);
  assert.deepEqual(fake.votes, [{ reviewerId: "id-me", vote: 5 }]);
  assert.deepEqual(progress, ["0/4", "1/4", "2/4", "3/4"]);
  assert.ok(!stored.has(KEY));
});

test("a comment without a known iteration is placed in the newest one", async () => {
  const fake = createFake();
  const { options, store } = createSubmit(fake);
  store.add(KEY, { anchor: { ...TOTALS, iteration: null }, content: "Here" });
  await submitReview(options, { summary: "", vote: null });
  assert.deepEqual(fake.posted[0]?.iteration, { changeTrackingId: 5, id: 3 });
  assert.deepEqual(fake.requests, ["changes 3", "post"]);
});

test("a refused comment stays pending, the rest is posted, and the vote waits", async () => {
  const fake = createFake();
  fake.failPosts.add("Refused");
  const { options, store } = createSubmit(fake);
  const refused = store.add(KEY, { anchor: null, content: "Refused" });
  store.add(KEY, { anchor: null, content: "Fine" });

  const result = await submitReview(options, { summary: "", vote: 10 });

  assert.deepEqual(result, { failures: [{ httpStatus: 403, id: refused.id }], vote: "skipped" });
  assert.deepEqual(fake.votes, []);
  assert.deepEqual(
    store.pending(KEY).map(({ content, isAttempted }) => ({ content, isAttempted })),
    [{ content: "Refused", isAttempted: true }],
  );
});

test("a retry posts only what is left, and sends the vote", async () => {
  const fake = createFake();
  fake.failPosts.add("Refused");
  const { options, store, stored } = createSubmit(fake);
  store.add(KEY, { anchor: null, content: "Refused" });
  store.add(KEY, { anchor: null, content: "Fine" });
  await submitReview(options, { summary: "", vote: 10 });
  fake.failPosts.clear();

  const result = await submitReview(options, { summary: "", vote: 10 });

  assert.deepEqual(result, { failures: [], vote: "sent" });
  assert.deepEqual(
    fake.posted.map(({ content }) => content),
    ["Fine", "Refused"],
  );
  assert.ok(!stored.has(KEY));
});

test("a comment whose post reached Azure DevOps but whose answer was lost is not posted twice", async () => {
  const fake = createFake();
  const { options, store, stored } = createSubmit(fake);
  const lost = store.add(KEY, { anchor: TOTALS, content: "Why not sum here?" });
  store.change(KEY, lost.id, { isAttempted: true });
  fake.threads = [
    { comments: [{ content: "Why not sum here?" }], id: 1, isDeleted: true, threadContext: null },
    { comments: [{ content: "Why not sum here?" }], id: 2, threadContext: null },
    {
      comments: [{ content: "Why not sum here?" }],
      id: 3,
      threadContext: { filePath: "/src/totals.ts", rightFileStart: { line: 12, offset: 1 } },
    },
  ];

  const result = await submitReview(options, { summary: "", vote: null });

  assert.deepEqual(result, { failures: [], vote: "none" });
  assert.deepEqual(fake.posted, []);
  assert.deepEqual(fake.requests, ["threads"]);
  assert.ok(!stored.has(KEY));
});

test("a comment tried before that is not on the pull request is posted", async () => {
  const fake = createFake();
  const { options, store } = createSubmit(fake);
  const tried = store.add(KEY, { anchor: null, content: "Still missing" });
  store.change(KEY, tried.id, { isAttempted: true });
  fake.threads = [{ comments: [{ content: "Something else" }], id: 1 }];
  await submitReview(options, { summary: "", vote: null });
  assert.deepEqual(fake.posted, [{ content: "Still missing" }]);
});
