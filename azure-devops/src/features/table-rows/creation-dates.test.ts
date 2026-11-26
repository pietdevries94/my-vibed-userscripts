import type { AdoClient } from "../../core/ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";
import assert from "node:assert/strict";
import { createCreationDates } from "./creation-dates.ts";
import { test } from "node:test";

const CREATED = "2030-03-01T09:00:00.000Z";

const ref = (pullRequestId: number): PullRequestRef => ({
  project: "Shop",
  pullRequestId,
  repository: "web",
});

function onFakeApi(): {
  requests: number[];
  clock: { now: number; isFailing: boolean };
  client: Pick<AdoClient, "getPullRequestCreationDate">;
} {
  const requests: number[] = [];
  const clock = { isFailing: false, now: 0 };
  return {
    client: {
      async getPullRequestCreationDate({ pullRequestId }) {
        requests.push(pullRequestId);
        if (clock.isFailing) {
          throw new Error("offline");
        }
        return CREATED;
      },
    },
    clock,
    requests,
  };
}

test("fetches each pull request's creation date once, as it never changes", async () => {
  const { client, clock, requests } = onFakeApi();
  const dates = createCreationDates({ client, now: () => clock.now });
  assert.equal(dates.createdAt(7), null);
  await dates.sync([ref(7), ref(8)]);
  await dates.sync([ref(7), ref(8)]);
  assert.deepEqual(requests, [7, 8]);
  assert.equal(dates.createdAt(7), Date.parse(CREATED));
});

test("tries a failed request again after a minute", async () => {
  const { client, clock, requests } = onFakeApi();
  const dates = createCreationDates({ client, now: () => clock.now });
  clock.isFailing = true;
  await dates.sync([ref(7)]);
  clock.isFailing = false;
  await dates.sync([ref(7)]);
  assert.equal(dates.createdAt(7), null);
  clock.now = FAILED_REQUEST_RETRY_MS;
  await dates.sync([ref(7)]);
  assert.deepEqual(requests, [7, 7]);
  assert.equal(dates.createdAt(7), Date.parse(CREATED));
});
