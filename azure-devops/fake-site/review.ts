// The fake Azure DevOps behind a review: a pull request's status, iterations, changed
// files and threads from the Files tab's capture, the threads the script posts, and
// the vote it sends. Actions make the next post fail and complete the pull request.
import type {
  FakeRequest,
  FakeResponse,
  FakeSiteAction,
} from "../../shared/dev/fake-site/server.ts";
import { draftResponse } from "./drafts.ts";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";
import { reviewData } from "./data.ts";

const HTTP_FORBIDDEN = 403;
const FIRST_POSTED_THREAD_ID = 9001;
const PULL_REQUEST = String.raw`^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/\d+`;

interface ReviewState {
  /** The threads the script posted, as it sent them, each with the id it got. */
  postedThreads: unknown[];
  /** The votes the script sent, in order. */
  votes: unknown[];
  failingPosts: number;
  status: "active" | "completed";
}

const state: ReviewState = { failingPosts: 0, postedThreads: [], status: "active", votes: [] };

function threadsResponse(): FakeResponse {
  const captured = reviewData().data.review.threads.body?.value ?? [];
  return jsonResponse({ value: [...captured, ...state.postedThreads] });
}

function postThreadResponse(request: FakeRequest): FakeResponse {
  if (state.failingPosts > 0) {
    state.failingPosts -= 1;
    return { ...jsonResponse({ message: "refused by the fake site" }), status: HTTP_FORBIDDEN };
  }
  const id = FIRST_POSTED_THREAD_ID + state.postedThreads.length;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the script sends an object
  state.postedThreads.push({ ...(JSON.parse(request.body) as object), id });
  return jsonResponse({ id });
}

/** A PUT on a reviewer with only a vote. One with `isRequired` adds a reviewer instead. */
function voteResponse(request: FakeRequest): FakeResponse | null {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the script sends this shape
  const body = JSON.parse(request.body) as { isRequired?: boolean; vote?: number };
  if (body.isRequired !== undefined) {
    return null;
  }
  state.votes.push(body.vote);
  return jsonResponse({ vote: body.vote });
}

type Route = [string, RegExp, (request: FakeRequest) => FakeResponse | null];

const ROUTES: Route[] = [
  ["GET", new RegExp(`${PULL_REQUEST}$`, "u"), () => jsonResponse({ status: state.status })],
  [
    "GET",
    new RegExp(`${PULL_REQUEST}\\/iterations$`, "u"),
    () => jsonResponse(reviewData().data.review.iterations.body),
  ],
  [
    "GET",
    new RegExp(`${PULL_REQUEST}\\/iterations\\/\\d+\\/changes$`, "u"),
    () => jsonResponse(reviewData().data.review.newestIterationChanges?.body ?? {}),
  ],
  ["GET", new RegExp(`${PULL_REQUEST}\\/threads$`, "u"), threadsResponse],
  ["POST", new RegExp(`${PULL_REQUEST}\\/threads$`, "u"), postThreadResponse],
  ["PUT", new RegExp(`${PULL_REQUEST}\\/reviewers\\/[^/]+$`, "u"), voteResponse],
];

/** The answer to a review request, or to a list page's draft request, or null for another request. */
function reviewResponse(request: FakeRequest): FakeResponse | null {
  const draft = draftResponse(request);
  if (draft !== null) {
    return draft;
  }
  for (const [method, pattern, answer] of ROUTES) {
    if (method === request.method && pattern.test(request.url.pathname)) {
      return answer(request);
    }
  }
  return null;
}

function resetReview(): void {
  Object.assign(state, { failingPosts: 0, postedThreads: [], status: "active", votes: [] });
}

const reviewActions: FakeSiteAction[] = [
  {
    description: "The threads and votes the script posted for a review.",
    example: "",
    name: "posted-review",
    run: () => ({ threads: state.postedThreads, votes: state.votes }),
  },
  {
    description: "Azure DevOps refuses the next posts of a thread, `count` times (default 1).",
    example: "count=1",
    name: "fail-next-thread",
    run: (query) => {
      state.failingPosts = Number(query.get("count") ?? 1);
      return { failingPosts: state.failingPosts };
    },
  },
  {
    description: "Completes the pull request, or with status=active opens it again.",
    example: "status=completed",
    name: "set-pull-request-status",
    run: (query) => {
      state.status = query.get("status") === "active" ? "active" : "completed";
      return { status: state.status };
    },
  },
  {
    description: "Forgets the posted threads and votes, and opens the pull request again.",
    example: "",
    name: "reset-review",
    run: () => {
      resetReview();
      return "reset";
    },
  },
];

export { reviewActions, reviewResponse };
