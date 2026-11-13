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

function markAvatar(avatar: HTMLElement, initials: string, hue: string): void {
  if (initials) {
    avatar.dataset.fixAdoInitials = initials;
  } else {
    delete avatar.dataset.fixAdoInitials;
  }
  avatar.style.setProperty("--fix-ado-hue", hue || null);
  // The initials scale with the avatar, whatever size class ADO gave it.
  if (initials && avatar.offsetWidth > 0) {
    avatar.style.setProperty("--fix-ado-avatar-size", `${avatar.offsetWidth}px`);
  }
}

/**
 * Marks every avatar under `root` with the initials and colour of its name.
 * It only sets attributes; style.css draws the initials over ADO's picture.
 * That leaves ADO's own elements in place, so hover cards keep working. An
 * avatar without a name keeps ADO's picture. Safe to call repeatedly.
 */
function showInitialsOnAvatars(root: ParentNode): void {
  for (const avatar of root.querySelectorAll<HTMLElement>(AVATAR_SELECTOR)) {
    const name = avatarName(avatar);
    const initials = initialsOf(name);
    const shownInitials = avatar.dataset.fixAdoInitials ?? "";
    const hue = initials ? String(hueOf(name)) : "";
    const isUpToDate =
      shownInitials === initials && avatar.style.getPropertyValue("--fix-ado-hue") === hue;
    if (!isUpToDate) {
      markAvatar(avatar, initials, hue);
    }
  }
}

export { AVATAR_SELECTOR, avatarName, showInitialsOnAvatars };
