// The pull request page for the starred reviewer tests, and the feature on it with a fake
// client, store and scheduler. Test code only.
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { JSDOM } from "jsdom";
import type { StarredReviewersOptions } from "./starred-reviewers.ts";
import assert from "node:assert/strict";
import { createStarredReviewers } from "./starred-reviewers.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";

const PULL_REQUEST = { project: "Ledger Works", pullRequestId: 4711, repository: "ledger-api" };
const QUILL: Identity = {
  displayName: "Quill Barrow",
  id: "id-quill",
  isGroup: false,
  signInAddress: "quill@example.com",
};
const TEAM: Identity = {
  displayName: String.raw`[Ledger Works]\Ledger Team`,
  id: "id-team",
  isGroup: true,
  signInAddress: "",
};
const MARREN: Identity = {
  displayName: "Marren Tolk",
  id: "id-marren",
  isGroup: false,
  signInAddress: "marren@example.com",
};

function reviewerRow(name: string): string {
  return `<div class="repos-reviewer flex-row flex-center">
    <svg class="bolt-status"></svg>
    <div><div class="bolt-coin" aria-label="${name}"></div></div>
    <div class="flex-column flex-grow text-ellipsis icon-large-margin">
      <div class="body-m flex-grow text-ellipsis">${name}</div>
      <div class="body-s secondary-text text-ellipsis">No response</div>
    </div>
    <div class="repos-reviewer-reveal"><button>⋮</button></div>
  </div>`;
}

const PAGE = `<!doctype html><body><div class="flex-column">
  <div class="bolt-header">Reviewers</div>
  <div class="flex-grow flex-column pr-required-reviewers-section">
    <div class="margin-bottom-8">Required</div>${reviewerRow("Quill Barrow")}
  </div>
  <div class="flex-grow flex-column pr-optional-reviewers-section">
    <div class="margin-bottom-8">Optional</div>${reviewerRow("Ledger Team")}
  </div>
</div></body>`;

interface Harness {
  document: Document;
  saved: Identity[];
  added: { reviewerId: string; isRequired: boolean }[];
  searched: string[];
  reloads: number;
  scheduled: (() => void)[];
}

type Client = StarredReviewersOptions["client"];

function fakeClient(harness: Harness, overrides: Partial<Client>): Client {
  return {
    addPullRequestReviewer: async (_pullRequest, reviewer) => {
      harness.added.push(reviewer);
    },
    getPullRequestReviewers: async () => [QUILL, TEAM],
    searchIdentities: async (query) => {
      harness.searched.push(query);
      return [QUILL, MARREN];
    },
    ...overrides,
  };
}

function featureOptions(harness: Harness, client: Client): StarredReviewersOptions {
  return {
    client,
    document: harness.document,
    imageUrlOf: ({ id }) => `/avatars/${id}`,
    reload: () => {
      harness.reloads += 1;
    },
    schedule: (callback): (() => void) => {
      harness.scheduled.push(callback);
      return () => {
        harness.scheduled.splice(harness.scheduled.indexOf(callback), 1);
      };
    },
    store: createStarredReviewersStore({
      load: () => harness.saved,
      save: (list) => {
        harness.saved = list;
      },
    }),
  };
}

/** The page with the feature synced once, and a function to sync again. */
function setUp(
  starred: Identity[],
  overrides: Partial<Client> = {},
): Harness & { sync: () => void; runScheduled: () => void } {
  const harness: Harness = {
    added: [],
    document: new JSDOM(PAGE).window.document,
    reloads: 0,
    saved: [...starred],
    scheduled: [],
    searched: [],
  };
  const feature = createStarredReviewers(featureOptions(harness, fakeClient(harness, overrides)));
  const sync = (): void => {
    feature.sync(PULL_REQUEST);
  };
  sync();
  return Object.assign(harness, {
    runScheduled: (): void => {
      for (const callback of harness.scheduled.splice(0)) {
        callback();
      }
    },
    sync,
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function section(document: Document): HTMLElement {
  const found = document.querySelector<HTMLElement>(".fix-ado-starred-reviewers");
  assert.ok(found, "the starred section is on the page");
  return found;
}

function starredNames(document: Document): string[] {
  return [...section(document).querySelectorAll(".fix-ado-starred-reviewer .body-m")].map(
    (name) => name.textContent ?? "",
  );
}

/** True while the starred row spins: a spinner on its + button, and its buttons disabled. */
function isAdding(document: Document): boolean {
  const row = section(document).querySelector(".fix-ado-starred-reviewer");
  const buttons = [...(row?.querySelectorAll("[data-fix-ado-add]") ?? [])];
  return (
    row?.querySelector(".fix-ado-spinner") !== null &&
    buttons.every((button) => button.hasAttribute("disabled"))
  );
}

export { MARREN, QUILL, TEAM, isAdding, reviewerRow, section, settle, setUp, starredNames };
