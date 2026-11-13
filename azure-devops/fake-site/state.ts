// What the fake site's actions change, on top of the captured pages: build statuses,
// pull request changes, required reviewers and work item changes.
import { boardData, showPullRequestCapture } from "./data.ts";
import { BUILD_POLICY_TYPE_ID } from "../src/pipeline-status.ts";
import type { BoardWorkItem } from "../src/board.ts";
import type { FakeSiteAction } from "../../shared/dev/fake-site/server.ts";
import type { ListedPullRequest } from "../src/pr-list-changes.ts";
import type { PolicyEvaluation } from "../src/pipeline-status.ts";
import { addedReviewers } from "./reviewers.ts";

/** Build statuses the set-build-status action takes, besides "reset". */
const BUILD_STATUSES = [
  "queued",
  "notStarted",
  "running",
  "approved",
  "rejected",
  "broken",
  "expired",
];
const SOMEONE_ELSE_ID = "00000000-0000-4000-8000-0000000fffff";

const buildStatuses = new Map<string, string>();
const pullRequestRevisions = new Map<number, number>();
const requiredReviewers = new Map<number, Set<number>>();
const workItemChanges = new Map<number, { rev: number; changedById: string }>();

function buildStatusKey(page: string, pullRequestId: string): string {
  return `${page}:${pullRequestId}`;
}

/** A build evaluation with the given status. "notStarted" is queued without a build; "expired" is approved but expired. */
function withBuildStatus(evaluation: PolicyEvaluation, status: string): PolicyEvaluation {
  if (evaluation.configuration.type.id !== BUILD_POLICY_TYPE_ID) {
    return evaluation;
  }
  const buildId = status === "notStarted" ? null : (evaluation.context?.buildId ?? 1);
  const shownStatus = { expired: "approved", notStarted: "queued" }[status] ?? status;
  return {
    ...evaluation,
    context: {
      ...evaluation.context,
      buildId: buildId ?? undefined,
      isExpired: status === "expired",
    },
    status: shownStatus,
  };
}

/** The evaluations of a pull request, with the build status an action set. */
function currentEvaluations(
  page: string,
  pullRequestId: string,
  captured: PolicyEvaluation[],
): PolicyEvaluation[] {
  const status = buildStatuses.get(buildStatusKey(page, pullRequestId));
  return status === undefined
    ? captured
    : captured.map((evaluation) => withBuildStatus(evaluation, status));
}

/** A listed pull request with the changes and required reviewers the actions made. */
function currentPullRequest(pullRequest: ListedPullRequest): ListedPullRequest {
  const current = structuredClone(pullRequest);
  const required = requiredReviewers.get(pullRequest.pullRequestId) ?? new Set<number>();
  for (const [index, reviewer] of (current.reviewers ?? []).entries()) {
    if (required.has(index)) {
      reviewer.isRequired = true;
    }
  }
  const revision = pullRequestRevisions.get(pullRequest.pullRequestId);
  if (revision !== undefined) {
    current.lastMergeSourceCommit = { commitId: `fake-commit-${revision}` };
  }
  return current;
}

/** A captured work item with the changes the actions made. */
function currentWorkItem(workItem: BoardWorkItem): BoardWorkItem {
  return { ...workItem, ...workItemChanges.get(workItem.id) };
}

function numberParameter(query: URLSearchParams, name: string): number {
  const value = Number(query.get(name));
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be a whole number`);
  }
  return value;
}

function setBuildStatus(query: URLSearchParams): unknown {
  const key = buildStatusKey(query.get("page") ?? "pr-list", query.get("pullRequestId") ?? "");
  const status = query.get("status") ?? "";
  if (status === "reset") {
    buildStatuses.delete(key);
  } else if (BUILD_STATUSES.includes(status)) {
    buildStatuses.set(key, status);
  } else {
    throw new TypeError(`status must be reset or one of ${BUILD_STATUSES.join(", ")}`);
  }
  return Object.fromEntries(buildStatuses);
}

function changePullRequest(query: URLSearchParams): unknown {
  const pullRequestId = numberParameter(query, "pullRequestId");
  pullRequestRevisions.set(pullRequestId, (pullRequestRevisions.get(pullRequestId) ?? 0) + 1);
  return Object.fromEntries(pullRequestRevisions);
}

function toggleRequiredReviewer(query: URLSearchParams): unknown {
  const pullRequestId = numberParameter(query, "pullRequestId");
  const index = numberParameter(query, "index");
  const required = requiredReviewers.get(pullRequestId) ?? new Set<number>();
  if (!required.delete(index)) {
    required.add(index);
  }
  requiredReviewers.set(pullRequestId, required);
  return Object.fromEntries([...requiredReviewers].map(([id, indexes]) => [id, [...indexes]]));
}

function changeWorkItem(query: URLSearchParams): unknown {
  const id = numberParameter(query, "id");
  const captured = boardData().data.workItems.find((workItem) => workItem.id === id);
  if (captured === undefined) {
    throw new TypeError(`no work item ${id} on the captured board`);
  }
  const changedById =
    query.get("by") === "me" ? (boardData().data.myUserId ?? SOMEONE_ELSE_ID) : SOMEONE_ELSE_ID;
  workItemChanges.set(id, { changedById, rev: currentWorkItem(captured).rev + 1 });
  return Object.fromEntries(workItemChanges);
}

function reset(): unknown {
  for (const changes of [buildStatuses, pullRequestRevisions, requiredReviewers, workItemChanges]) {
    changes.clear();
  }
  addedReviewers.length = 0;
  showPullRequestCapture("");
  return "reset";
}

/** The first card of the captured board, for the index link. */
function firstWorkItemId(): number {
  return boardData().data.workItems[0]?.id ?? 0;
}

function actions(): FakeSiteAction[] {
  return [
    {
      description: `The build status of a pull request on a page (pr-list or pr-inbox): ${BUILD_STATUSES.join(", ")}, or reset.`,
      example: "page=pr-list&pullRequestId=1001&status=running",
      name: "set-build-status",
      run: setBuildStatus,
    },
    {
      description: "A new commit on a listed pull request. The list page reloads itself.",
      example: "pullRequestId=1001",
      name: "change-pull-request",
      run: changePullRequest,
    },
    {
      description: "Makes a reviewer of a listed pull request required, or optional again.",
      example: "pullRequestId=1002&index=1",
      name: "toggle-required-reviewer",
      run: toggleRequiredReviewer,
    },
    {
      description: "Someone else (or by=me, the signed-in user) changes a work item on the board.",
      example: `id=${firstWorkItemId()}&by=other`,
      name: "change-work-item",
      run: changeWorkItem,
    },
    {
      description:
        "Shows another capture as the pull request page: reviewers, reviewers-add, reviewers-search, split-menu, or warnings (the default).",
      example: "name=reviewers",
      name: "show-pull-request-capture",
      run: (query) => showPullRequestCapture(query.get("name") ?? ""),
    },
    {
      description: "The reviewers the script added, with required or optional.",
      example: "",
      name: "added-reviewers",
      run: () => addedReviewers,
    },
    { description: "Undoes every action.", example: "", name: "reset", run: reset },
  ];
}

export { actions, currentEvaluations, currentPullRequest, currentWorkItem };
