// The client's work item requests: the board's cards and their updates, and the work items
// linked to a pull request.
import type { AdoClientOptions } from "./ado-request.ts";
import type { BoardWorkItem } from "../boards/board.ts";
import type { PullRequestRef } from "../pull-requests/pull-request-link.ts";
import type { WorkItemUpdate } from "../features/days-in-column/days-in-column.ts";
import { getJson } from "./ado-request.ts";

interface WorkItemsResponse {
  workItems: BoardWorkItem[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface WorkItemUpdatesResponse {
  /** Oldest first. */
  updates: WorkItemUpdate[];
  /** Set when Azure DevOps asks the caller to slow down. */
  retryAfterSeconds: number | null;
}

interface WorkItemRequests {
  getWorkItems: (ids: number[]) => Promise<WorkItemsResponse>;
  /** Every change to one work item, oldest first. */
  getWorkItemUpdates: (id: number) => Promise<WorkItemUpdatesResponse>;
  /** The ids of the work items linked to a pull request. */
  getPullRequestWorkItemIds: (pullRequest: PullRequestRef) => Promise<number[]>;
  /** Null for a work item that was deleted or is not readable. */
  getWorkItemTitle: (id: number) => Promise<string | null>;
}

/** A work item from the work items API. With errorPolicy=Omit, null for one that was deleted or is not readable. */
type WorkItemBody = {
  id: number;
  rev: number;
  fields?: { "System.ChangedBy"?: { id?: string } };
} | null;

/** The work items API accepts at most this many ids per request. */
const MAX_WORK_ITEMS_PER_REQUEST = 200;

/** The updates API returns at most this many updates per request. */
const MAX_UPDATES_PER_REQUEST = 200;

function toBoardWorkItems(values: unknown[] | undefined): BoardWorkItem[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  const workItems = values as WorkItemBody[];
  return workItems.flatMap((workItem) =>
    workItem === null
      ? []
      : [
          {
            changedById: workItem.fields?.["System.ChangedBy"]?.id ?? null,
            id: workItem.id,
            rev: workItem.rev,
          },
        ],
  );
}

async function getWorkItems(options: AdoClientOptions, ids: number[]): Promise<WorkItemsResponse> {
  const workItems: BoardWorkItem[] = [];
  let retryAfterSeconds: number | null = null;
  for (let start = 0; start < ids.length; start += MAX_WORK_ITEMS_PER_REQUEST) {
    const idsInRequest = ids.slice(start, start + MAX_WORK_ITEMS_PER_REQUEST);
    // oxlint-disable-next-line eslint/no-await-in-loop -- TODO(lint): batches go one at a time; parallel batches would change the request pattern
    const response = await getJson(
      options,
      `/_apis/wit/workitems?ids=${idsInRequest.join(",")}&fields=System.Rev,System.ChangedBy&errorPolicy=Omit&api-version=7.1`,
    );
    retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
    workItems.push(...toBoardWorkItems(response.body.value));
  }
  return { retryAfterSeconds, workItems };
}

async function getWorkItemUpdates(
  options: AdoClientOptions,
  id: number,
): Promise<WorkItemUpdatesResponse> {
  const updates: WorkItemUpdate[] = [];
  let retryAfterSeconds: number | null = null;
  for (let skip = 0; ; skip += MAX_UPDATES_PER_REQUEST) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each page tells whether there is a next one
    const response = await getJson(
      options,
      `/_apis/wit/workItems/${id}/updates?$top=${MAX_UPDATES_PER_REQUEST}&$skip=${skip}&api-version=7.1`,
    );
    retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
    const page = (response.body.value ?? []) as WorkItemUpdate[];
    updates.push(...page);
    if (page.length < MAX_UPDATES_PER_REQUEST) {
      return { retryAfterSeconds, updates };
    }
  }
}

async function getPullRequestWorkItemIds(
  options: AdoClientOptions,
  { project, repository, pullRequestId }: PullRequestRef,
): Promise<number[]> {
  const { body } = await getJson(
    options,
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}` +
      `/pullRequests/${pullRequestId}/workitems?api-version=7.1`,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return ((body.value ?? []) as { id: string }[]).map(({ id }) => Number(id));
}

async function getWorkItemTitle(options: AdoClientOptions, id: number): Promise<string | null> {
  const { body } = await getJson(
    options,
    `/_apis/wit/workitems?ids=${id}&fields=System.Title&errorPolicy=Omit&api-version=7.1`,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  const [workItem] = (body.value ?? []) as ({ fields?: { "System.Title"?: string } } | null)[];
  return workItem?.fields?.["System.Title"] ?? null;
}

/** The client's work item requests, for `createAdoClient`. */
function createWorkItemRequests(options: AdoClientOptions): WorkItemRequests {
  return {
    getPullRequestWorkItemIds: async (pullRequest) =>
      getPullRequestWorkItemIds(options, pullRequest),
    getWorkItemTitle: async (id) => getWorkItemTitle(options, id),
    getWorkItemUpdates: async (id) => getWorkItemUpdates(options, id),
    getWorkItems: async (ids) => getWorkItems(options, ids),
  };
}

export type { WorkItemRequests, WorkItemUpdatesResponse, WorkItemsResponse };
export { createWorkItemRequests };
