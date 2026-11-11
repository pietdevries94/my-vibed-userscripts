/** A reviewer of a pull request, from the Git pull requests REST API. */
export interface Reviewer {
  id?: string;
  displayName?: string;
  vote?: number;
  /** Azure DevOps leaves this out for optional reviewers. */
  isRequired?: boolean;
}

/** Teams are named "[Project]\Team". People can carry a suffix like "(Company)". */
function personOrTeamName(displayName: string): string {
  return displayName.replace(/^\[[^\]]*\]\\/, "").replace(/\([^)]*\)/g, "").trim();
}

/**
 * First letter of the first name and of the surname.
 * "Tomas van Elst", "Elst, Tomas van" and "tomas.van.elst@example.com" all give "TE".
 */
export function initialsOf(displayName: string): string {
  const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);
  const emailMatch = displayName.trim().match(/^([^\s@]+)@[^\s@]+$/);
  // Some avatars are labelled with the sign-in address: "tomas.van.elst@example.com".
  const name = emailMatch ? emailMatch[1]!.replace(/[._-]+/g, " ") : personOrTeamName(displayName);
  const commaIndex = name.indexOf(",");
  const isSurnameFirst = commaIndex >= 0;
  const firstNames = wordsOf(isSurnameFirst ? name.slice(commaIndex + 1) : name);
  const surnameWords = isSurnameFirst ? wordsOf(name.slice(0, commaIndex)) : firstNames.slice(1);
  return [firstNames[0], surnameWords[surnameWords.length - 1]]
    .map((word) => [...(word ?? "")][0] ?? "")
    .join("")
    .toUpperCase();
}

/** A stable colour per name, as a hue from 0 to 359. */
export function hueOf(name: string): number {
  // FNV-1a, so that names that differ in one character get very different hues.
  let hash = 2166136261;
  for (const character of name.trim().toLowerCase()) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  }
  return hash % 360;
}

/**
 * The reviewer an avatar belongs to, found by name in the avatar's label.
 * The longest name wins, so "Ann Lee" is not mistaken for "Ann".
 */
export function findReviewerByLabel(avatarLabel: string, reviewers: Reviewer[]): Reviewer | null {
  const label = avatarLabel.toLowerCase();
  let bestMatch: Reviewer | null = null;
  let bestMatchLength = 0;
  for (const reviewer of reviewers) {
    if (!reviewer.displayName) continue;
    for (const name of [reviewer.displayName, personOrTeamName(reviewer.displayName)]) {
      if (name.length > bestMatchLength && label.includes(name.toLowerCase())) {
        bestMatch = reviewer;
        bestMatchLength = name.length;
      }
    }
  }
  return bestMatch;
}
