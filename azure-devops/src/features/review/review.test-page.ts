// A review on a captured pull request page, with a fake Azure DevOps behind it.
// Test code only.
import type { NewThread } from "../../pull-requests/review-requests.ts";
import type { ReviewOptions } from "./review.ts";
import type { TestReviewStore } from "./review-store.test-page.ts";
import { createReview } from "./review.ts";
import { createTestReviewStore } from "./review-store.test-page.ts";
import { loadCapturedPullRequest } from "../../pull-requests/captured-pull-request.test-page.ts";

const KEY = "review:test";
const PULL_REQUEST = { project: "Ledger Works", pullRequestId: 4711, repository: "ledger-api" };
const NEWEST_ITERATION = 3;
const FIRST_THREAD_ID = 100;

interface ReviewPage extends TestReviewStore {
  document: Document;
  /** What the fake Azure DevOps got and what the page was told. */
  posted: NewThread[];
  votes: number[];
  copied: string[];
  reloads: number[];
  /** The files the fake Azure DevOps says the pull request changes. Set before the first sync. */
  changedPaths: string[];
  /** Syncs the review, as the script does after every change to the page. */
  sync: () => void;
  /** The button with this exact text, which must be on the page. */
  button: (text: string) => HTMLButtonElement;
  /** Types into a text box, as the owner does. */
  type: (textarea: HTMLTextAreaElement, text: string) => void;
}

function openDialog(this: HTMLDialogElement): void {
  this.open = true;
}

function closeDialog(this: HTMLDialogElement): void {
  this.open = false;
  const view = this.ownerDocument.defaultView;
  if (view !== null) {
    this.dispatchEvent(new view.Event("close"));
  }
}

function fakeClient(
  page: Pick<ReviewPage, "changedPaths" | "posted" | "votes">,
  status: string,
): ReviewOptions["client"] {
  return {
    createPullRequestThread: async (_pullRequest, thread) => {
      page.posted.push(thread);
      return FIRST_THREAD_ID + page.posted.length;
    },
    getAuthenticatedUserId: async () => "id-me",
    getIterationChanges: async () =>
      page.changedPaths.map((path, index) => ({ changeTrackingId: index + 1, item: { path } })),
    getPullRequestIterationIds: async () => [1, 2, NEWEST_ITERATION],
    getPullRequestStatus: async () => status,
    getPullRequestThreads: async () => [],
    setPullRequestVote: async (_pullRequest, { vote }) => {
      page.votes.push(vote);
    },
  };
}

function buttonIn(document: Document, text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === text,
  );
  if (found === undefined) {
    throw new Error(`no "${text}" button on the page`);
  }
  return found;
}

/** A captured page with the review feature on it. `status` is the pull request's. */
function loadReviewPage(fixture: string, status = "active"): ReviewPage {
  const { document } = loadCapturedPullRequest(fixture);
  const view = document.defaultView;
  if (view === null) {
    throw new Error("the captured page has no window");
  }
  // The test page has no dialog methods.
  Object.assign(view.HTMLDialogElement.prototype, { close: closeDialog, showModal: openDialog });
  const calls = {
    changedPaths: [] as string[],
    copied: [] as string[],
    posted: [] as NewThread[],
    reloads: [] as number[],
    votes: [] as number[],
  };
  const testStore = createTestReviewStore();
  const feature = createReview({
    client: fakeClient(calls, status),
    confirm: () => true,
    copy: (text) => {
      calls.copied.push(text);
    },
    document,
    keyOf: () => KEY,
    reload: () => {
      calls.reloads.push(1);
    },
    store: testStore.store,
  });
  return {
    ...calls,
    ...testStore,
    button: (text) => buttonIn(document, text),
    document,
    sync: () => {
      feature.sync(PULL_REQUEST);
    },
    type: (textarea, text) => {
      textarea.value = text;
      textarea.dispatchEvent(new view.Event("input", { bubbles: true }));
    },
  };
}

/** Lets the requests the page started finish. */
async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export type { ReviewPage };
export { KEY, NEWEST_ITERATION, loadReviewPage, settle };
