import type { PullRequestListPage, PullRequestRef } from "./pull-request-link.ts";
import { REVIEWER_REFRESH_INTERVAL_MS, createInboxReviewerFetcher } from "./inbox-reviewers.ts";
import type { AdoClient } from "./ado-client.ts";
import { AdoRequestError } from "./ado-client.ts";
import { FAILED_REQUEST_RETRY_MS } from "./pipeline-status-poller.ts";
import type { InboxReviewerFetcher } from "./inbox-reviewers.ts";
import type { Reviewer } from "./reviewers.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const requiredReviewer: Reviewer = { displayName: "Ann Lee", isRequired: true };

interface FakeInbox {
  clock: number;
  fetchedPages: PullRequestListPage[];
  listed: PullRequestRef[];
  failNextFetch: boolean;
  reviewers: Map<number, Reviewer[]>;
}

function fetcherOnFakeInbox(listed: PullRequestRef[]): {
  inbox: FakeInbox;
  fetcher: InboxReviewerFetcher;
} {
  const inbox: FakeInbox = {
    clock: 0,
    failNextFetch: false,
    fetchedPages: [],
    listed,
    reviewers: new Map(),
  };
  const client: Pick<AdoClient, "getPullRequests"> = {
    async getPullRequests(listPage) {
      inbox.fetchedPages.push(listPage);
      if (inbox.failNextFetch) {
        inbox.failNextFetch = false;
        throw new AdoRequestError(500, null);
      }
      const pullRequests = inbox.listed
        .filter(({ repository }) => repository === listPage.repository)
        .map(({ pullRequestId }) => ({ pullRequestId, reviewers: [requiredReviewer] }));
      return { pullRequests, retryAfterSeconds: null };
    },
  };
  const fetcher = createInboxReviewerFetcher({
    client,
    findPullRequests: () => inbox.listed,
    now: () => inbox.clock,
    reviewersByPullRequestId: inbox.reviewers,
  });
  return { fetcher, inbox };
}

const pullRequestIn = (repository: string, pullRequestId: number): PullRequestRef => ({
  project: "project",
  pullRequestId,
  repository,
});

test("fetches the reviewers once per repository in the inbox", async () => {
  const { fetcher, inbox } = fetcherOnFakeInbox([
    pullRequestIn("repo-a", 1),
    pullRequestIn("repo-a", 2),
    pullRequestIn("repo-b", 3),
  ]);
  await fetcher.sync();
  assert.deepEqual(inbox.fetchedPages, [
    { project: "project", repository: "repo-a", status: "active" },
    { project: "project", repository: "repo-b", status: "active" },
  ]);
  assert.deepEqual([...inbox.reviewers.keys()], [1, 2, 3]);
  assert.deepEqual(inbox.reviewers.get(3), [requiredReviewer]);
});

test("a repository is fetched again only after the refresh interval", async () => {
  const { fetcher, inbox } = fetcherOnFakeInbox([pullRequestIn("repo-a", 1)]);
  await fetcher.sync();
  inbox.clock = REVIEWER_REFRESH_INTERVAL_MS - 1;
  await fetcher.sync();
  assert.equal(inbox.fetchedPages.length, 1);
  inbox.clock = REVIEWER_REFRESH_INTERVAL_MS;
  await fetcher.sync();
  assert.equal(inbox.fetchedPages.length, 2);
});

test("a failed fetch is retried after the retry delay", async () => {
  const { fetcher, inbox } = fetcherOnFakeInbox([pullRequestIn("repo-a", 1)]);
  inbox.failNextFetch = true;
  await fetcher.sync();
  assert.equal(inbox.reviewers.size, 0);
  inbox.clock = FAILED_REQUEST_RETRY_MS - 1;
  await fetcher.sync();
  assert.equal(inbox.fetchedPages.length, 1);
  inbox.clock = FAILED_REQUEST_RETRY_MS;
  await fetcher.sync();
  assert.deepEqual(inbox.reviewers.get(1), [requiredReviewer]);
});

test("calls made while a fetch runs do not fetch twice", async () => {
  const { fetcher, inbox } = fetcherOnFakeInbox([pullRequestIn("repo-a", 1)]);
  await Promise.all([fetcher.sync(), fetcher.sync()]);
  assert.equal(inbox.fetchedPages.length, 1);
});
