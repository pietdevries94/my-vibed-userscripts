// The requests a review sends: a pull request's threads, iterations and changed files,
// a new thread, and the owner's vote.
import { getJson, sendRequest } from "../core/ado-request.ts";
import type { AdoClientOptions } from "../core/ado-request.ts";
import type { PullRequestRef } from "./pull-request-link.ts";

/** A line and column in a file. Both count from 1. */
interface FilePosition {
  line: number;
  offset: number;
}

/** Where a thread sits in a file. The left side is the file before the change. */
interface ThreadContext {
  filePath: string;
  leftFileStart?: FilePosition;
  leftFileEnd?: FilePosition;
  rightFileStart?: FilePosition;
  rightFileEnd?: FilePosition;
}

/** A thread as Azure DevOps lists it, as far as a review reads it. */
interface PullRequestThread {
  id: number;
  isDeleted?: boolean;
  /** Such as `active`, `pending` or `fixed`. A system thread has none. */
  status?: string;
  /** `commentType` is `text` for a person's comment and `system` for Azure DevOps's. */
  comments?: { content?: string; commentType?: string }[];
  threadContext?: ThreadContext | null;
  /** When the thread was created. */
  publishedDate?: string;
  /** A system thread names its kind here, such as `IsDraftUpdate`. */
  properties?: { CodeReviewThreadType?: { $value?: string } };
}

/** A thread to create. Without `threadContext` it is a comment on the pull request as a whole. */
interface NewThread {
  content: string;
  threadContext?: ThreadContext;
  /** The diff the owner looked at: the iteration, and the file's id in it. */
  iteration?: { id: number; changeTrackingId: number };
}

/** A file an iteration changed. */
interface IterationChange {
  changeTrackingId: number;
  /** The file now. A deleted file has no path here: Azure DevOps sends null. */
  item?: { path?: string | null };
  /** The path before the change, as of a deleted or renamed file. */
  originalPath?: string;
}

interface ReviewRequests {
  /** "active", "completed" or "abandoned". */
  getPullRequestStatus: (pullRequest: PullRequestRef) => Promise<string>;
  /** When the pull request was created, as an ISO date. */
  getPullRequestCreationDate: (pullRequest: PullRequestRef) => Promise<string>;
  getPullRequestThreads: (pullRequest: PullRequestRef) => Promise<PullRequestThread[]>;
  /** The ids of a pull request's iterations, oldest first. */
  getPullRequestIterationIds: (pullRequest: PullRequestRef) => Promise<number[]>;
  getIterationChanges: (
    pullRequest: PullRequestRef,
    iteration: number,
  ) => Promise<IterationChange[]>;
  /** Posts a thread, visible to everyone at once. Returns its id. */
  createPullRequestThread: (pullRequest: PullRequestRef, thread: NewThread) => Promise<number>;
  /** Sets the vote of one reviewer: 10, 5, -5 or -10. */
  setPullRequestVote: (
    pullRequest: PullRequestRef,
    vote: { reviewerId: string; vote: number },
  ) => Promise<void>;
}

const API_VERSION = "api-version=7.1";
/** How many changed files the script asks for at once. Azure DevOps may give fewer. */
const CHANGES_PER_REQUEST = 500;
const ACTIVE_THREAD_STATUS = 1;
const TEXT_COMMENT_TYPE = 1;

function pullRequestPath({ project, repository, pullRequestId }: PullRequestRef): string {
  return (
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}` +
    `/pullRequests/${pullRequestId}`
  );
}

async function getPullRequest(
  options: AdoClientOptions,
  pullRequest: PullRequestRef,
): Promise<{ status?: string; creationDate?: string }> {
  const response = await sendRequest(options, `${pullRequestPath(pullRequest)}?${API_VERSION}`);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return (await response.json()) as { status?: string; creationDate?: string };
}

/** Where a page of changed files starts, and how many files it asks for. */
interface ChangesPage {
  skip: number;
  top: number;
}

interface ChangesResponse {
  changeEntries?: IterationChange[];
  /** Where the next page starts. Missing or 0 on the last page. */
  nextSkip?: number;
  nextTop?: number;
}

/** The page after this one, or null when Azure DevOps names none. */
function pageAfter({ nextSkip, nextTop }: ChangesResponse): ChangesPage | null {
  const hasNext = nextSkip !== undefined && nextSkip > 0;
  return hasNext ? { skip: nextSkip, top: nextTop ?? CHANGES_PER_REQUEST } : null;
}

async function getIterationChanges(
  options: AdoClientOptions,
  pullRequest: PullRequestRef,
  iteration: number,
): Promise<IterationChange[]> {
  const changes: IterationChange[] = [];
  let next: ChangesPage | null = { skip: 0, top: CHANGES_PER_REQUEST };
  while (next !== null) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each page starts where the last one ended
    const response = await sendRequest(
      options,
      `${pullRequestPath(pullRequest)}/iterations/${iteration}/changes` +
        `?$top=${next.top}&$skip=${next.skip}&${API_VERSION}`,
    );
    // oxlint-disable-next-line eslint/no-await-in-loop, typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
    const body = (await response.json()) as ChangesResponse;
    const page = body.changeEntries ?? [];
    changes.push(...page);
    next = page.length === 0 ? null : pageAfter(body);
  }
  return changes;
}

/** The body Azure DevOps's own comment box sends for a new thread. */
function threadBody({ content, iteration, threadContext }: NewThread): unknown {
  return {
    comments: [{ commentType: TEXT_COMMENT_TYPE, content, parentCommentId: 0 }],
    status: ACTIVE_THREAD_STATUS,
    ...(threadContext === undefined ? {} : { threadContext }),
    ...(iteration === undefined
      ? {}
      : {
          pullRequestThreadContext: {
            changeTrackingId: iteration.changeTrackingId,
            iterationContext: {
              firstComparingIteration: iteration.id,
              secondComparingIteration: iteration.id,
            },
          },
        }),
  };
}

async function createPullRequestThread(
  options: AdoClientOptions,
  pullRequest: PullRequestRef,
  thread: NewThread,
): Promise<number> {
  const response = await sendRequest(
    options,
    `${pullRequestPath(pullRequest)}/threads?${API_VERSION}`,
    { body: threadBody(thread), method: "POST" },
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  const body = (await response.json()) as { id: number };
  return body.id;
}

/** The client's review requests, for `createAdoClient`. */
function createReviewRequests(options: AdoClientOptions): ReviewRequests {
  return {
    createPullRequestThread: async (pullRequest, thread) =>
      createPullRequestThread(options, pullRequest, thread),
    getIterationChanges: async (pullRequest, iteration) =>
      getIterationChanges(options, pullRequest, iteration),
    getPullRequestCreationDate: async (pullRequest) =>
      getPullRequest(options, pullRequest).then(({ creationDate }) => creationDate ?? ""),
    async getPullRequestIterationIds(pullRequest) {
      const { body } = await getJson(
        options,
        `${pullRequestPath(pullRequest)}/iterations?${API_VERSION}`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
      return ((body.value ?? []) as { id: number }[]).map(({ id }) => id);
    },
    getPullRequestStatus: async (pullRequest) =>
      getPullRequest(options, pullRequest).then(({ status }) => status ?? ""),
    async getPullRequestThreads(pullRequest) {
      const { body } = await getJson(
        options,
        `${pullRequestPath(pullRequest)}/threads?${API_VERSION}`,
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
      return (body.value ?? []) as PullRequestThread[];
    },
    async setPullRequestVote(pullRequest, { reviewerId, vote }) {
      await sendRequest(
        options,
        `${pullRequestPath(pullRequest)}/reviewers/${encodeURIComponent(reviewerId)}?${API_VERSION}`,
        { body: { vote }, method: "PUT" },
      );
    },
  };
}

export type { IterationChange, NewThread, PullRequestThread, ReviewRequests, ThreadContext };
export { createReviewRequests };
