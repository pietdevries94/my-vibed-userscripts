import {
  LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS,
  createLinkedWorkItemFetcher,
} from "./linked-work-item-fetcher.ts";
import type { AdoClient } from "../../core/ado-client.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { LinkedWorkItemFetcher } from "./linked-work-item-fetcher.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const ref = (pullRequestId: number): PullRequestRef => ({
  project: "Shop",
  pullRequestId,
  repository: "web",
});

interface FakeList {
  clock: number;
  listed: PullRequestRef[];
  linkedIds: Map<number, number[]>;
  titles: Map<number, string>;
  requests: string[];
  failNext: boolean;
}

function fetcherOnFakeList(listed: PullRequestRef[]): {
  fetcher: LinkedWorkItemFetcher;
  list: FakeList;
} {
  const list: FakeList = {
    clock: 0,
    failNext: false,
    linkedIds: new Map(),
    listed,
    requests: [],
    titles: new Map(),
  };
  const client: Pick<AdoClient, "getPullRequestWorkItemIds" | "getWorkItemTitle"> = {
    async getPullRequestWorkItemIds({ pullRequestId }) {
      list.requests.push(`work items ${pullRequestId}`);
      if (list.failNext) {
        list.failNext = false;
        throw new AdoRequestError(500, null);
      }
      return list.linkedIds.get(pullRequestId) ?? [];
    },
    async getWorkItemTitle(id) {
      list.requests.push(`title ${id}`);
      return list.titles.get(id) ?? null;
    },
  };
  const fetcher = createLinkedWorkItemFetcher({
    client,
    findPullRequests: () => list.listed,
    now: () => list.clock,
  });
  return { fetcher, list };
}

test("knows nothing before the first fetch", () => {
  const { fetcher } = fetcherOnFakeList([ref(1)]);
  assert.equal(fetcher.linkedWorkItems(1), null);
});

test("fetches the title of the one linked work item", async () => {
  const { fetcher, list } = fetcherOnFakeList([ref(1)]);
  list.linkedIds.set(1, [123]);
  list.titles.set(123, "Fix the login form");
  await fetcher.sync();
  assert.deepEqual(list.requests, ["work items 1", "title 123"]);
  assert.deepEqual(fetcher.linkedWorkItems(1), { ids: [123], title: "Fix the login form" });
});

test("does not fetch titles when none or several work items are linked", async () => {
  const { fetcher, list } = fetcherOnFakeList([ref(1), ref(2)]);
  list.linkedIds.set(2, [123, 456]);
  await fetcher.sync();
  assert.deepEqual(list.requests, ["work items 1", "work items 2"]);
  assert.deepEqual(fetcher.linkedWorkItems(1), { ids: [], title: null });
  assert.deepEqual(fetcher.linkedWorkItems(2), { ids: [123, 456], title: null });
});

test("does not fetch again before the refresh interval", async () => {
  const { fetcher, list } = fetcherOnFakeList([ref(1)]);
  await fetcher.sync();
  list.clock = LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS - 1;
  await fetcher.sync();
  assert.deepEqual(list.requests, ["work items 1"]);
  list.clock = LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS;
  await fetcher.sync();
  assert.deepEqual(list.requests, ["work items 1", "work items 1"]);
});

test("a failed fetch keeps what was known and retries after the retry delay", async () => {
  const { fetcher, list } = fetcherOnFakeList([ref(1)]);
  list.linkedIds.set(1, [123, 456]);
  await fetcher.sync();
  list.clock = LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS;
  list.failNext = true;
  await fetcher.sync();
  assert.deepEqual(fetcher.linkedWorkItems(1), { ids: [123, 456], title: null });
  list.clock += FAILED_REQUEST_RETRY_MS - 1;
  await fetcher.sync();
  assert.equal(list.requests.length, 2);
  list.clock += 1;
  await fetcher.sync();
  assert.equal(list.requests.length, 3);
});
