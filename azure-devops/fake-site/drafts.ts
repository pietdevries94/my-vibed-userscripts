// Draft and publish on the fake pull request lists. The toggle-draft action moves a listed
// pull request into draft or out of it: the list page flips its Draft pill, the repository
// list API reports the new isDraft, and the pull request's threads gain an IsDraftUpdate
// thread, as Azure DevOps adds one on each change.
import type {
  FakeRequest,
  FakeResponse,
  FakeSiteAction,
} from "../../shared/dev/fake-site/server.ts";
import type { ListedPullRequest } from "../src/features/reload-on-changes/pr-list-changes.ts";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";

const MS_PER_HOUR = 3_600_000;
const HOURS_PER_ID = 13;
/** Spreads the invented creation dates over 0 to 59 days ago. */
const FAKE_CREATION_SPREAD_HOURS = 1440;
const PULL_REQUEST = String.raw`^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/(?<id>\d+)`;

/** The times of each pull request's draft changes, oldest first. */
const draftChanges = new Map<number, string[]>();

/** True when the actions flipped the pull request's captured draft state. */
function isDraftFlipped(pullRequestId: number): boolean {
  return (draftChanges.get(pullRequestId)?.length ?? 0) % 2 === 1;
}

function toggleDraft(query: URLSearchParams): unknown {
  const pullRequestId = Number(query.get("pullRequestId"));
  if (!Number.isInteger(pullRequestId)) {
    throw new TypeError("pullRequestId must be a whole number");
  }
  draftChanges.set(pullRequestId, [
    ...(draftChanges.get(pullRequestId) ?? []),
    new Date().toISOString(),
  ]);
  return Object.fromEntries(draftChanges);
}

/** Captured dates are minutes apart, so creation dates are invented from the id. */
function inventedCreationDate(pullRequestId: number): string {
  const hoursAgo = (pullRequestId * HOURS_PER_ID) % FAKE_CREATION_SPREAD_HOURS;
  return new Date(Date.now() - hoursAgo * MS_PER_HOUR).toISOString();
}

const isFromPullRequestList = (request: FakeRequest): boolean =>
  /\/(?:pullrequests|_pulls)$/u.test(request.refererPath ?? "");

function draftThreadsResponse(pullRequestId: number): FakeResponse {
  const value = (draftChanges.get(pullRequestId) ?? []).map((date, index) => ({
    id: index + 1,
    properties: { CodeReviewThreadType: { $type: "System.String", $value: "IsDraftUpdate" } },
    publishedDate: date,
  }));
  return jsonResponse({ count: value.length, value });
}

/** The answer to a list page's request for a pull request or its threads, or null. */
function draftResponse(request: FakeRequest): FakeResponse | null {
  const match = new RegExp(`${PULL_REQUEST}(?<threads>\\/threads)?$`, "u").exec(
    request.url.pathname,
  );
  if (request.method !== "GET" || !isFromPullRequestList(request) || match === null) {
    return null;
  }
  const pullRequestId = Number(match.groups?.id);
  return match.groups?.threads === undefined
    ? jsonResponse({ creationDate: inventedCreationDate(pullRequestId), status: "active" })
    : draftThreadsResponse(pullRequestId);
}

/** A listed pull request's draft state, with the flips the actions made. */
function currentIsDraft({ pullRequestId, isDraft }: ListedPullRequest): boolean {
  return (isDraft === true) !== isDraftFlipped(pullRequestId);
}

/** Page script that flips the Draft pill of each listed pull request the actions flipped. */
function draftPillScript(page: string): string {
  if (page !== "pr-list" && page !== "pr-inbox") {
    return "";
  }
  const flipped = [...draftChanges.keys()].filter((id) => isDraftFlipped(id));
  return `
  for (const id of ${JSON.stringify(flipped)}) {
    const row = document.querySelector(\`a.bolt-table-row[href$="/pullrequest/\${id}"]\`);
    const pill = row?.querySelector(".repos-pr-list-draft-pill");
    if (pill) {
      pill.remove();
    } else {
      row?.querySelector(".bolt-table-two-line-cell-item > .body-l")?.insertAdjacentHTML(
        "afterend",
        '<div class="repos-pr-list-draft-pill flex-noshrink margin-left-4 bolt-pill flex-row flex-center outlined compact"><div class="bolt-pill-content text-ellipsis">Draft</div></div>',
      );
    }
  }`;
}

const draftActions: FakeSiteAction[] = [
  {
    description:
      "Moves a listed pull request into draft, or publishes it again. The list page reloads itself.",
    example: "pullRequestId=1002",
    name: "toggle-draft",
    run: toggleDraft,
  },
];

export { currentIsDraft, draftActions, draftChanges, draftPillScript, draftResponse };
