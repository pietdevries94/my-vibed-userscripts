/** A reviewer of a pull request, from the Git pull requests REST API. */
interface Reviewer {
  id?: string;
  displayName?: string;
  vote?: number;
  /** Azure DevOps leaves this out for optional reviewers. */
  isRequired?: boolean;
}

const EMAIL_ADDRESS = /^(?<localPart>[^\s@]+)@[^\s@]+$/u;
/** A sign-in address after a name, with or without angle brackets: "Holt, Mira <mira@example.com>". */
const TRAILING_SIGN_IN_ADDRESS = /\s+<?[^\s<>@]+@[^\s<>@]+>?$/u;
// FNV-1a, so that names that differ in one character get very different hues.
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const HUE_COUNT = 360;

/** Teams are named "[Project]\Team". People can carry a suffix like "(Company)". */
function personOrTeamName(displayName: string): string {
  return displayName
    .replace(/^\[[^\]]*\]\\/u, "")
    .replaceAll(/\([^)]*\)/gu, "")
    .trim();
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

function firstCharacter(word: string | undefined): string {
  const codePoint = (word ?? "").codePointAt(0);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
}

/**
 * The name in a label, without a sign-in address after it, a company suffix or a team
 * prefix. A label that is only a sign-in address gives its name part:
 * "tomas.van.elst@example.com" gives "tomas van elst".
 */
function nameInLabel(label: string): string {
  const localPart = EMAIL_ADDRESS.exec(label.trim())?.groups?.localPart;
  return localPart === undefined
    ? personOrTeamName(label.trim().replace(TRAILING_SIGN_IN_ADDRESS, ""))
    : localPart.replaceAll(/[._-]+/gu, " ");
}

/**
 * First letter of the first name and of the surname.
 * "Tomas van Elst", "Elst, Tomas van" and "tomas.van.elst@example.com" all give "TE".
 */
function initialsOf(displayName: string): string {
  const name = nameInLabel(displayName);
  const commaIndex = name.indexOf(",");
  const isSurnameFirst = commaIndex !== -1;
  const firstNames = wordsOf(isSurnameFirst ? name.slice(commaIndex + 1) : name);
  const surnameWords = isSurnameFirst ? wordsOf(name.slice(0, commaIndex)) : firstNames.slice(1);
  return [firstNames[0], surnameWords.at(-1)]
    .map((word) => firstCharacter(word))
    .join("")
    .toUpperCase();
}

/**
 * A stable colour per person, as a hue from 0 to 359. It hashes the words of the name in
 * sorted order, so "Elst, Tomas van", "Tomas van Elst" and "tomas.van.elst@example.com"
 * get the same hue.
 */
function hueOf(label: string): number {
  const nameKey = wordsOf(nameInLabel(label).replaceAll(",", " ").toLowerCase())
    .toSorted()
    .join(" ");
  let hash = FNV_OFFSET_BASIS;
  for (const character of nameKey) {
    // oxlint-disable-next-line eslint/no-bitwise -- TODO(lint): FNV-1a is defined with xor and an unsigned shift; other arithmetic would change every hue
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
  }
  return hash % HUE_COUNT;
}

function namesOf(reviewer: Reviewer): string[] {
  const { displayName } = reviewer;
  return displayName === undefined || displayName === ""
    ? []
    : [displayName, personOrTeamName(displayName)];
}

/**
 * The reviewer an avatar belongs to, found by name in the avatar's label.
 * The longest name wins, so "Ann Lee" is not mistaken for "Ann".
 */
function findReviewerByLabel(avatarLabel: string, reviewers: Reviewer[]): Reviewer | null {
  const label = avatarLabel.toLowerCase();
  let bestMatch: Reviewer | null = null;
  let bestMatchLength = 0;
  for (const reviewer of reviewers) {
    for (const name of namesOf(reviewer)) {
      if (name.length > bestMatchLength && label.includes(name.toLowerCase())) {
        bestMatch = reviewer;
        bestMatchLength = name.length;
      }
    }
  }
  return bestMatch;
}

export type { Reviewer };
export { findReviewerByLabel, hueOf, initialsOf, personOrTeamName };
