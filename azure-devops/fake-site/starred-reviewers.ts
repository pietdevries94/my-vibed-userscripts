// Invented starred reviewers the fake site can put in the script's storage, so pages show
// the starred reviewers' chips and lists. The script keeps the list in GM storage, which the
// fake site's GM shim starts empty on every page load; the page's own script fills it.
import type { FakeSiteAction } from "../../shared/dev/fake-site/server.ts";

const INVENTED_STARRED_PEOPLE = [
  {
    displayName: "Vale, Juniper",
    id: "00000000-0000-4000-8000-00000000a001",
    isGroup: false,
    signInAddress: "juniper.vale@example.test",
  },
  {
    displayName: "Lena Okafor",
    id: "00000000-0000-4000-8000-00000000a002",
    isGroup: false,
    signInAddress: "lena.okafor@example.test",
  },
  {
    displayName: "Otto Pennywhistle",
    id: "00000000-0000-4000-8000-00000000a003",
    isGroup: false,
    signInAddress: "otto.pennywhistle@example.test",
  },
];

let showsStarredReviewers = false;

/** The page script that stores the invented starred people, under the script's own key. */
function starredReviewersScript(): string {
  if (!showsStarredReviewers) {
    return "";
  }
  const key = `"starred-reviewers:" + location.host + "/" + location.pathname.split("/")[1]`;
  return `globalThis.GM_setValue?.(${key}, ${JSON.stringify(INVENTED_STARRED_PEOPLE)});`;
}

function resetStarredReviewers(): void {
  showsStarredReviewers = false;
}

const starredReviewerActions: FakeSiteAction[] = [
  {
    description: "Gives the script three invented starred reviewers (on=0 takes them away).",
    example: "on=1",
    name: "starred-reviewers",
    run: (query) => {
      showsStarredReviewers = query.get("on") !== "0";
      return showsStarredReviewers
        ? INVENTED_STARRED_PEOPLE.map(({ displayName }) => displayName)
        : [];
    },
  },
];

export { resetStarredReviewers, starredReviewerActions, starredReviewersScript };
