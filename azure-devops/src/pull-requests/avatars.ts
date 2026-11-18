import { hueOf, initialsOf } from "./reviewers.ts";

// ADO has two avatar components: bolt-coin (pull requests) and vss-Persona (boards).
// A project's picture is a vss-Persona too, and is not a person.
const AVATAR_SELECTOR = ".bolt-coin, .vss-Persona:not(.project-persona)";

/** The name ADO labels an avatar with. Decorative avatars have none. */
function avatarName(avatar: Element): string {
  const label = avatar.getAttribute("aria-label") ?? "";
  const imageAlt = avatar.querySelector("img")?.getAttribute("alt") ?? "";
  return (label === "" ? imageAlt : label).trim();
}

/** What an avatar should show, and its width, read before any avatar is changed. */
interface AvatarMark {
  avatar: HTMLElement;
  initials: string;
  hue: string;
  width: number;
}

function markAvatar({ avatar, initials, hue, width }: AvatarMark): void {
  if (initials) {
    avatar.dataset.fixAdoInitials = initials;
  } else {
    delete avatar.dataset.fixAdoInitials;
  }
  avatar.style.setProperty("--fix-ado-hue", hue || null);
  // The initials scale with the avatar, whatever size class ADO gave it.
  if (initials && width > 0) {
    avatar.style.setProperty("--fix-ado-avatar-size", `${width}px`);
  }
}

/** The avatars under `root` whose initials or colour are out of date, with what they should show. */
function outdatedAvatars(root: ParentNode): AvatarMark[] {
  const marks: AvatarMark[] = [];
  for (const avatar of root.querySelectorAll<HTMLElement>(AVATAR_SELECTOR)) {
    const name = avatarName(avatar);
    const initials = initialsOf(name);
    const hue = initials ? String(hueOf(name)) : "";
    const isUpToDate =
      (avatar.dataset.fixAdoInitials ?? "") === initials &&
      avatar.style.getPropertyValue("--fix-ado-hue") === hue;
    if (!isUpToDate) {
      marks.push({ avatar, hue, initials, width: initials ? avatar.offsetWidth : 0 });
    }
  }
  return marks;
}

/**
 * Marks every avatar under `root` with the initials and colour of its name.
 * It only sets attributes; style.css draws the initials over ADO's picture.
 * That leaves ADO's own elements in place, so hover cards keep working. An
 * avatar without a name keeps ADO's picture. Safe to call repeatedly.
 * All widths are read before the first change, so the browser lays out once.
 */
function showInitialsOnAvatars(root: ParentNode): void {
  for (const mark of outdatedAvatars(root)) {
    markAvatar(mark);
  }
}

export { AVATAR_SELECTOR, avatarName, showInitialsOnAvatars };
