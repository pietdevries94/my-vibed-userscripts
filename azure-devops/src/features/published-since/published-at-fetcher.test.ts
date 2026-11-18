import {
  PUBLISHED_AT_REFRESH_INTERVAL_MS,
  createPublishedAtFetcher,
} from "./published-at-fetcher.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { PublishedAtFetcher } from "./published-at-fetcher.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import type { PullRequestThread } from "../../pull-requests/review-requests.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const CREATED = "2030-03-01T09:00:00.000Z";
const PUBLISHED = "2030-03-02T09:00:00.000Z";

const ref = (pullRequestId: number): PullRequestRef => ({
  project: "Shop",
  pullRequestId,
  repository: "web",
});

interface FakeList {
  clock: number;
  listed: { pullRequest: PullRequestRef; isDraft: boolean }[];
  threads: Map<number, PullRequestThread[]>;
  requests: string[];
  failNext: boolean;
}

function fetcherOnFakeList(listed: FakeList["listed"]): {
  fetcher: PublishedAtFetcher;
  list: FakeList;
} {
  const list: FakeList = { clock: 0, failNext: false, listed, requests: [], threads: new Map() };
  const client: Pick<AdoClient, "getPullRequestCreationDate" | "getPullRequestThreads"> = {
    async getPullRequestCreationDate({ pullRequestId }) {
      list.requests.push(`created ${pullRequestId}`);
      return CREATED;
    },
    async getPullRequestThreads({ pullRequestId }) {
      list.requests.push(`threads ${pullRequestId}`);
      if (list.failNext) {
        list.failNext = false;
        throw new AdoRequestError(500, null);
      }
      return list.threads.get(pullRequestId) ?? [];
    },
  };
  const fetcher = createPublishedAtFetcher({
    client,
    findRows: () => list.listed,
    now: () => list.clock,
  });
  return { fetcher, list };
}

const publishThread: PullRequestThread = {
  id: 1,
  properties: { CodeReviewThreadType: { $value: "IsDraftUpdate" } },
  publishedDate: PUBLISHED,
};

test("fetches the publish time of published pull requests only", async () => {
  const { fetcher, list } = fetcherOnFakeList([
    { isDraft: false, pullRequest: ref(1) },
    { isDraft: true, pullRequest: ref(2) },
  ]);
  list.threads.set(1, [publishThread]);
  await fetcher.sync();
  assert.deepEqual(list.requests, ["threads 1"]);
  assert.equal(fetcher.publishedAt(1), Date.parse(PUBLISHED));
  assert.equal(fetcher.publishedAt(2), null);
});

test("without a draft change, the creation date is the publish time", async () => {
  const { fetcher, list } = fetcherOnFakeList([{ isDraft: false, pullRequest: ref(1) }]);
  await fetcher.sync();
  assert.deepEqual(list.requests, ["threads 1", "created 1"]);
  assert.equal(fetcher.publishedAt(1), Date.parse(CREATED));
});

test("does not fetch again before the refresh interval", async () => {
  const { fetcher, list } = fetcherOnFakeList([{ isDraft: false, pullRequest: ref(1) }]);
  list.threads.set(1, [publishThread]);
  await fetcher.sync();
  list.clock = PUBLISHED_AT_REFRESH_INTERVAL_MS - 1;
  await fetcher.sync();
  assert.deepEqual(list.requests, ["threads 1"]);
  list.clock = PUBLISHED_AT_REFRESH_INTERVAL_MS;
  await fetcher.sync();
  assert.deepEqual(list.requests, ["threads 1", "threads 1"]);
});

test("a pull request seen as draft forgets its publish time and fetches it again once published", async () => {
  const { fetcher, list } = fetcherOnFakeList([{ isDraft: false, pullRequest: ref(1) }]);
  list.threads.set(1, [publishThread]);
  await fetcher.sync();
  list.listed = [{ isDraft: true, pullRequest: ref(1) }];
  await fetcher.sync();
  assert.equal(fetcher.publishedAt(1), null);

  const republished = "2030-03-09T09:00:00.000Z";
  list.threads.set(1, [publishThread, { ...publishThread, id: 2, publishedDate: republished }]);
  list.listed = [{ isDraft: false, pullRequest: ref(1) }];
  await fetcher.sync();
  assert.equal(fetcher.publishedAt(1), Date.parse(republished));
});

test("a failed fetch retries after the retry delay", async () => {
  const { fetcher, list } = fetcherOnFakeList([{ isDraft: false, pullRequest: ref(1) }]);
  list.failNext = true;
  await fetcher.sync();
  assert.equal(fetcher.publishedAt(1), null);
  list.clock = FAILED_REQUEST_RETRY_MS - 1;
  await fetcher.sync();
  assert.equal(list.requests.length, 1);
  list.clock = FAILED_REQUEST_RETRY_MS;
  await fetcher.sync();
  assert.equal(fetcher.publishedAt(1), Date.parse(CREATED));
});
