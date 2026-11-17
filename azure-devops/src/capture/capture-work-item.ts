// The work item capture: the work item form and how its avatars are labelled.
// Dev file only.
import { AVATAR_SELECTOR, avatarName } from "../pull-requests/avatars.ts";
import type { CapturePage } from "../../../shared/dev/capture/capture.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

const WORK_ITEM_EDIT_PATH = /\/_workitems\/edit\/\d+/u;
/** Elements that may be avatars but that AVATAR_SELECTOR might miss. */
const AVATAR_CANDIDATE_SELECTOR = `${AVATAR_SELECTOR}, img[class*="identity"], [class*="identity-picture"], [class*="persona"]`;
const EMAIL_ADDRESS = /\S+@\S+/u;

/** Where an avatar's name comes from: its own label, its picture's alt, or nowhere. */
function nameSource(avatar: Element): string {
  if ((avatar.getAttribute("aria-label") ?? "").trim() !== "") {
    return "aria-label";
  }
  return (avatar.querySelector("img")?.getAttribute("alt") ?? "").trim() === "" ? "none" : "alt";
}

/** The shape of an avatar and its name, without the name itself. */
function avatarProbe(avatar: HTMLElement): Record<string, unknown> {
  const label = avatarName(avatar);
  const box = avatar.getBoundingClientRect();
  const style = getComputedStyle(avatar);
  return {
    borderRadius: style.borderRadius,
    classes: [...avatar.classList].filter((className) => /^[\w-]{1,40}$/u.test(className)),
    hasComma: label.includes(","),
    hasEmail: EMAIL_ADDRESS.test(label),
    hasInitialsMark: avatar.dataset.fixAdoInitials !== undefined,
    hasParentheses: label.includes("("),
    height: Math.round(box.height),
    isScriptAvatar: avatar.matches(AVATAR_SELECTOR),
    nameSource: nameSource(avatar),
    tag: avatar.localName,
    width: Math.round(box.width),
    wordCount: label.split(/\s+/u).filter(Boolean).length,
  };
}

/** The work item page, or null when `location` is not a work item. */
function workItemPageAt(location: { pathname: string }): CapturePage | null {
  if (!WORK_ITEM_EDIT_PATH.test(location.pathname)) {
    return null;
  }
  return {
    collect: async () => ({
      data: {},
      meta: {
        avatars: [...document.querySelectorAll<HTMLElement>(AVATAR_CANDIDATE_SELECTOR)].map(
          (avatar) => avatarProbe(avatar),
        ),
      },
    }),
    name: "work-item",
    root: withoutScriptMarks(document.body),
    styleRoot: document.body,
  };
}

export { workItemPageAt };
