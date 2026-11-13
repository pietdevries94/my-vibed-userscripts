import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { JSDOM } from "jsdom";
import type { StarredReviewersOptions } from "./starred-reviewers.ts";
import assert from "node:assert/strict";
import { createStarredReviewers } from "./starred-reviewers.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import { test } from "node:test";

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

test("without starred reviewers, the section under Optional explains what it is for", () => {
  const { document } = setUp([]);
  const starred = section(document);
  assert.equal(
    starred.previousElementSibling,
    document.querySelector(".pr-optional-reviewers-section"),
  );
  assert.match(starred.textContent ?? "", /Add starred as reviewer/u);
  assert.match(
    starred.querySelector(".repos-pr-no-items-well")?.textContent ?? "",
    /^Put people\/groups here you often add as pull requests/u,
  );
  assert.match(
    starred.querySelector(".fix-ado-star-someone")?.textContent ?? "",
    /Add person\/group to starred/u,
  );
});

test("lists starred reviewers that are not on the pull request yet, each with a + button", () => {
  const { document } = setUp([QUILL, MARREN, TEAM]);
  assert.deepEqual(starredNames(document), ["Marren Tolk"]);
  const row = section(document).querySelector(".fix-ado-starred-reviewer");
  assert.ok(row?.querySelector('.bolt-split-button [data-fix-ado-add="optional"]'));
  assert.ok(row?.querySelector('[data-fix-ado-add="required"]'));
  assert.equal(document.querySelector(".repos-pr-no-items-well"), null);
});

test("each reviewer row gets a star, filled for a starred reviewer", () => {
  const { document } = setUp([QUILL]);
  const stars = [
    ...document.querySelectorAll(".pr-required-reviewers-section .fix-ado-star"),
    ...document.querySelectorAll(".pr-optional-reviewers-section .fix-ado-star"),
  ];
  assert.deepEqual(
    stars.map((star) => star.getAttribute("aria-pressed")),
    ["true", "false"],
  );
  assert.equal(
    stars[0]?.nextElementSibling?.className,
    "repos-reviewer-reveal",
    "the star sits before the ⋮ button",
  );
});

test("a click on a row's star stars that reviewer, with the id from the pull request, and a second unstars", async () => {
  const harness = setUp([]);
  harness.document
    .querySelector<HTMLElement>(".pr-optional-reviewers-section .fix-ado-star")
    ?.click();
  await settle();
  assert.deepEqual(harness.saved, [TEAM]);
  // A second click unstars.
  harness.document
    .querySelector<HTMLElement>(".pr-optional-reviewers-section .fix-ado-star")
    ?.click();
  await settle();
  assert.deepEqual(harness.saved, []);
});

test("the + button adds the reviewer as optional and takes the row away", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  assert.deepEqual(harness.added, [{ isRequired: false, reviewerId: "id-marren" }]);
  assert.deepEqual(starredNames(harness.document), []);
});

test("the page reloads when Azure DevOps does not show the added reviewer", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  harness.runScheduled();
  assert.equal(harness.reloads, 1);
});

test("no reload when Azure DevOps shows the added reviewer", async () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  harness.document
    .querySelector(".pr-optional-reviewers-section")
    ?.insertAdjacentHTML("beforeend", reviewerRow("Marren Tolk"));
  harness.sync();
  harness.runScheduled();
  assert.equal(harness.reloads, 0);
});

test("the required button adds the reviewer as required, and says so in its tooltip", async () => {
  const harness = setUp([MARREN]);
  const required = section(harness.document).querySelector<HTMLElement>(
    '[data-fix-ado-add="required"]',
  );
  assert.equal(required?.title, "Add as required reviewer");
  required?.click();
  await settle();
  assert.deepEqual(harness.added, [{ isRequired: true, reviewerId: "id-marren" }]);
});

test("a failed add keeps the row and says why", async () => {
  const harness = setUp([MARREN], {
    addPullRequestReviewer: async () => {
      throw new Error("HTTP 403");
    },
  });
  section(harness.document).querySelector<HTMLElement>('[data-fix-ado-add="optional"]')?.click();
  await settle();
  assert.deepEqual(starredNames(harness.document), ["Marren Tolk"]);
  assert.equal(
    section(harness.document).querySelector(".fix-ado-starred-detail")?.textContent,
    "Could not add: HTTP 403",
  );
});

test("the star from a starred row unstars it", () => {
  const harness = setUp([MARREN]);
  section(harness.document).querySelector<HTMLElement>(".fix-ado-star")?.click();
  assert.deepEqual(harness.saved, []);
  assert.ok(harness.document.querySelector(".fix-ado-starred-empty"));
});

test("a sync without changes leaves the list as it is", () => {
  const harness = setUp([MARREN]);
  const row = section(harness.document).querySelector(".fix-ado-starred-reviewer");
  harness.sync();
  assert.equal(section(harness.document).querySelector(".fix-ado-starred-reviewer"), row);
});

test("the search field finds people and groups to star, without the starred ones", async () => {
  const harness = setUp([QUILL]);
  const starred = section(harness.document);
  starred.querySelector<HTMLElement>(".fix-ado-star-someone")?.click();
  const input = starred.querySelector<HTMLInputElement>(".fix-ado-star-picker input");
  assert.ok(input);
  assert.equal(harness.document.activeElement, input);
  input.value = "ma";
  input.dispatchEvent(new (harness.document.defaultView?.Event ?? Event)("input"));
  harness.runScheduled();
  await settle();
  assert.deepEqual(harness.searched, ["ma"]);
  const suggestions = [...starred.querySelectorAll(".bolt-suggestions-item .fontSizeM")];
  assert.deepEqual(
    suggestions.map((name) => name.textContent),
    ["Marren Tolk"],
  );
  starred.querySelector<HTMLElement>(".bolt-suggestions-item")?.click();
  assert.deepEqual(harness.saved, [QUILL, MARREN]);
  assert.equal(starred.querySelector(".fix-ado-star-picker"), null, "the field closed");
  assert.deepEqual(starredNames(harness.document), ["Marren Tolk"]);
});
