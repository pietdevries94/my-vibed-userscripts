// The fake site's answers for starred reviewers: the pull request's reviewers, from the
// names on the captured page; adding a reviewer, which it records; the identity search,
// over invented people and a group; and avatars.
import type { FakeRequest, FakeResponse } from "../../shared/dev/fake-site/server.ts";
import { JSDOM } from "jsdom";
import { jsonResponse } from "../../shared/dev/fake-site/server.ts";
import { pageHtml } from "./data.ts";

interface FakeIdentity {
  id: string;
  displayName: string;
  mail: string;
  isGroup: boolean;
}

/** Invented people and a group to find, besides the page's own reviewers. */
const SEARCHABLE: FakeIdentity[] = [
  { displayName: "Marren Tolk", id: "fake-marren", isGroup: false, mail: "marren@example.com" },
  { displayName: "Ivo Brandsma", id: "fake-ivo", isGroup: false, mail: "ivo@example.com" },
  { displayName: "Saskia Veldhuis", id: "fake-saskia", isGroup: false, mail: "saskia@example.com" },
  {
    displayName: String.raw`[fake-project]\Release Wardens`,
    id: "fake-release-wardens",
    isGroup: true,
    mail: "",
  },
];
const MAX_FOUND = 20;
const HUE_STEP = 47;
const HUE_COUNT = 360;

/** Reviewers the script added, as `id required|optional`, for the /__dev index. */
const addedReviewers: string[] = [];

function idOfName(name: string): string {
  return `fake-${name.toLowerCase().replaceAll(/[^a-z\d]+/gu, "-")}`;
}

/** The reviewers on the captured pull request page, by the names it shows. */
function pageReviewers(): FakeIdentity[] {
  const { document } = new JSDOM(pageHtml("pr-detail")).window;
  const rows = document.querySelectorAll(
    ".pr-required-reviewers-section > .repos-reviewer, .pr-optional-reviewers-section > .repos-reviewer",
  );
  return [...rows].map((row) => {
    const name = row.querySelector(".flex-column > .body-m")?.textContent?.trim() ?? "";
    return { displayName: name, id: idOfName(name), isGroup: false, mail: "" };
  });
}

function reviewersResponse(): FakeResponse {
  const value = pageReviewers().map(({ id, displayName, mail }) => ({
    displayName,
    id,
    uniqueName: mail,
    vote: 0,
  }));
  return jsonResponse({ count: value.length, value });
}

function addReviewerResponse(request: FakeRequest, match: RegExpExecArray): FakeResponse {
  const id = decodeURIComponent(match.groups?.id ?? "");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the script sends this shape
  const { isRequired } = JSON.parse(request.body) as { isRequired?: boolean };
  addedReviewers.push(`${id} ${isRequired === true ? "required" : "optional"}`);
  return jsonResponse({ id, isRequired: isRequired === true, vote: 0 });
}

function searchResponse(request: FakeRequest): FakeResponse {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the script sends this shape
  const { query } = JSON.parse(request.body) as { query?: string };
  const wanted = (query ?? "").toLowerCase();
  const identities = [...pageReviewers(), ...SEARCHABLE]
    .filter(({ displayName }) => displayName.toLowerCase().includes(wanted))
    .slice(0, MAX_FOUND)
    .map(({ id, displayName, mail, isGroup }) => ({
      displayName,
      entityType: isGroup ? "Group" : "User",
      localId: id,
      mail,
      signInAddress: mail,
    }));
  return jsonResponse({ results: [{ identities, queryToken: query }] });
}

/** A coloured circle per identity id. */
function avatarResponse(request: FakeRequest): FakeResponse {
  const id = request.url.searchParams.get("id") ?? "";
  let hue = 0;
  for (let index = 0; index < id.length; index += 1) {
    hue += id.codePointAt(index) ?? 0;
  }
  const fill = `hsl(${(hue * HUE_STEP) % HUE_COUNT} 45% 55%)`;
  return {
    body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${fill}"/></svg>`,
    contentType: "image/svg+xml",
  };
}

type Route = [string, RegExp, (request: FakeRequest, match: RegExpExecArray) => FakeResponse];

const REVIEWER_ROUTES: Route[] = [
  [
    "GET",
    /^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/\d+\/reviewers$/u,
    reviewersResponse,
  ],
  [
    "PUT",
    /^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullRequests\/\d+\/reviewers\/(?<id>[^/]+)$/u,
    addReviewerResponse,
  ],
  ["POST", /^\/fake-org\/_apis\/IdentityPicker\/Identities$/u, searchResponse],
  ["GET", /^\/fake-org\/_api\/_common\/identityImage$/u, avatarResponse],
];

/** The answer to a starred reviewers request, or null for another request. */
function reviewerResponse(request: FakeRequest): FakeResponse | null {
  for (const [method, pattern, answer] of REVIEWER_ROUTES) {
    const match = pattern.exec(request.url.pathname);
    if (match !== null && method === request.method) {
      return answer(request, match);
    }
  }
  return null;
}

export { addedReviewers, reviewerResponse };
