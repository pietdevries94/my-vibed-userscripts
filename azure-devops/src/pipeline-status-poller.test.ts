import assert from "node:assert/strict";
import { test } from "node:test";
import { AdoRequestError, type AdoClient } from "./ado-client.ts";
import { BUILD_POLICY_TYPE_ID, type PipelineStatus, type PolicyEvaluation } from "./pipeline-status.ts";
import {
  createPipelineStatusPoller, FAILED_REQUEST_RETRY_MS, IN_PROGRESS_POLL_INTERVAL_MS, SETTLED_POLL_INTERVAL_MS,
} from "./pipeline-status-poller.ts";

const buildEvaluation = (status: string): PolicyEvaluation => ({
  status,
  configuration: { isBlocking: true, type: { id: BUILD_POLICY_TYPE_ID } },
  context: { buildId: 1 },
});

function pollerOnFakeList(pullRequestIds: number[]) {
  const list = {
    clock: 0,
    listedIds: pullRequestIds,
    fetchedIds: [] as number[],
    shown: new Map<number, PipelineStatus | null>(),
    respond: (_pullRequestId: number): { evaluations: PolicyEvaluation[]; retryAfterSeconds: number | null } =>
      ({ evaluations: [buildEvaluation("approved")], retryAfterSeconds: null }),
  };
  const client: AdoClient = {
    async getPolicyEvaluations({ pullRequestId }) {
      list.fetchedIds.push(pullRequestId);
      return list.respond(pullRequestId);
    },
    async getPullRequests() {
      throw new Error("not used by the pipeline status poller");
    },
    async getWorkItems() {
      throw new Error("not used by the pipeline status poller");
    },
    async getAuthenticatedUserId() {
      throw new Error("not used by the pipeline status poller");
    },
  };
  const poller = createPipelineStatusPoller<number>({
    client,
    now: () => list.clock,
    findRows: () => list.listedIds.map((pullRequestId) => ({
      row: pullRequestId,
      pullRequest: { project: "project", repository: "repo", pullRequestId },
    })),
    showStatus: (row, _pullRequestId, status) => list.shown.set(row, status),
  });
  return { list, poller };
}

const respondWithBuild = (status: string) => () => ({ evaluations: [buildEvaluation(status)], retryAfterSeconds: null });

test("fetches and shows the status of every listed pull request", async () => {
  const { list, poller } = pollerOnFakeList([1, 2]);
  await poller.sync();
  assert.deepEqual(list.fetchedIds, [1, 2]);
  assert.deepEqual([...list.shown], [[1, "succeeded"], [2, "succeeded"]]);
});

test("a settled pull request is fetched again after the settled interval", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  await poller.sync();
  list.clock = SETTLED_POLL_INTERVAL_MS - 1;
  await poller.sync();
  assert.equal(list.fetchedIds.length, 1);
  list.clock = SETTLED_POLL_INTERVAL_MS;
  await poller.sync();
  assert.equal(list.fetchedIds.length, 2);
});

test("a running pull request is fetched again sooner and the shown status follows", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  list.respond = respondWithBuild("running");
  await poller.sync();
  assert.equal(list.shown.get(1), "running");

  list.respond = respondWithBuild("approved");
  list.clock = IN_PROGRESS_POLL_INTERVAL_MS;
  await poller.sync();
  assert.equal(list.shown.get(1), "succeeded");
});

test("a pull request listed twice is fetched once", async () => {
  const { list, poller } = pollerOnFakeList([1, 1]);
  await poller.sync();
  assert.deepEqual(list.fetchedIds, [1]);
});

test("a row that appears later gets the status already fetched", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  await poller.sync();
  list.shown.clear();
  await poller.sync();
  assert.equal(list.shown.get(1), "succeeded");
  assert.equal(list.fetchedIds.length, 1);
});

test("a failed request keeps the shown status and is retried later", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  list.respond = respondWithBuild("running");
  await poller.sync();

  list.respond = () => { throw new AdoRequestError(500, null); };
  list.clock = IN_PROGRESS_POLL_INTERVAL_MS;
  await poller.sync();
  assert.equal(list.shown.get(1), "running");

  list.clock += FAILED_REQUEST_RETRY_MS - 1;
  await poller.sync();
  assert.equal(list.fetchedIds.length, 2);
  list.clock += 1;
  await poller.sync();
  assert.equal(list.fetchedIds.length, 3);
});

test("a pull request that never loaded shows no icon", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  list.respond = () => { throw new AdoRequestError(403, null); };
  await poller.sync();
  assert.equal(list.shown.has(1), false);
});

test("Retry-After pauses all requests", async () => {
  const { list, poller } = pollerOnFakeList([1, 2]);
  list.respond = () => ({ evaluations: [buildEvaluation("approved")], retryAfterSeconds: 30 });
  await poller.sync();
  assert.deepEqual(list.fetchedIds, [1]);

  list.clock = 29_999;
  await poller.sync();
  assert.deepEqual(list.fetchedIds, [1]);
  list.clock = 30_000;
  list.respond = respondWithBuild("approved");
  await poller.sync();
  assert.deepEqual(list.fetchedIds, [1, 2]);
});

test("overlapping syncs do not fetch twice", async () => {
  const { list, poller } = pollerOnFakeList([1]);
  await Promise.all([poller.sync(), poller.sync()]);
  assert.deepEqual(list.fetchedIds, [1]);
});
