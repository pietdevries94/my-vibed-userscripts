// The last step of a capture. Refuses the output when any replaced value of three or
// more characters still appears in it, kept words included. A value counts when it
// appears as a whole word, ignoring case. Site words are skipped: values without
// digits of class, role and the script's kept attributes, and link segments that
// start with "_". They come from the site's code, so a page value that matches one
// gives nothing away. The report names
// the field, and shows where the value was found with the value itself and every
// other replaced value masked.
import { escapeRegExp, wordPattern } from "./word-pattern.ts";
import type { Pseudonyms } from "./pseudonyms.ts";
import type { ScrubRules } from "./rules.ts";

interface Leak {
  /** Where the value was replaced, such as `div.wit-card @data-itemid`. */
  field: string;
  /** The tag or JSON line where it still appears, with the value shown as [value]. */
  foundIn: string;
}

const MIN_LEAK_LENGTH = 3;
/** Characters of context shown on each side of a leak. */
const CONTEXT_LENGTH = 60;
/** Attributes whose values are site words, besides the script's kept attributes. */
const SITE_WORD_ATTRIBUTES = ["class", "role"];
const ROUTE_WORD = /(?<=\/)_[A-Za-z]+(?![\p{L}\p{N}])/gu;

function longestFirst(values: string[]): string[] {
  return values.toSorted((left, right) => right.length - left.length);
}

/** The output with every stand-in removed, so a stand-in never counts as a leak. */
function withoutStandIns(output: string, standIns: string[]): string {
  let text = output;
  for (const standIn of longestFirst(standIns.filter((value) => value !== ""))) {
    text = text.replaceAll(wordPattern(standIn), " ");
  }
  return text;
}

/** The output with site words blanked: attribute values without digits, and "_" link segments. */
function withoutSiteWords(output: string, rules: ScrubRules): string {
  const names = [...SITE_WORD_ATTRIBUTES, ...rules.keepAttributes]
    .map((name) => escapeRegExp(name))
    .join("|");
  const siteWordValue = new RegExp(`(?<= (?:${names})=")[^"]*`, "gu");
  return output
    .replaceAll(siteWordValue, (value) =>
      value
        .split(" ")
        .map((word) => (/\d/u.test(word) ? word : " "))
        .join(" "),
    )
    .replaceAll(ROUTE_WORD, " ");
}

function longOriginals(pseudonyms: Pseudonyms): { original: string; field: string }[] {
  return pseudonyms
    .replaced()
    .map(({ field, original }) => ({ field, original: original.trim() }))
    .filter(({ original }) => original.length >= MIN_LEAK_LENGTH);
}

/** `text` with every replaced value swapped for "[scrubbed]". For error messages and stacks. */
function redact(text: string, pseudonyms: Pseudonyms): string {
  let redacted = text;
  for (const original of longestFirst(
    longOriginals(pseudonyms).map((replaced) => replaced.original),
  )) {
    redacted = redacted.replaceAll(new RegExp(escapeRegExp(original), "giu"), "[scrubbed]");
  }
  return redacted;
}

/** The HTML tag, or else the line, around `index`. */
function surroundings(text: string, index: number): { start: number; end: number } {
  const tagStart = text.lastIndexOf("<", index);
  const isInTag = tagStart !== -1 && text.lastIndexOf(">", index) < tagStart;
  if (isInTag) {
    const tagEnd = text.indexOf(">", index);
    return { end: tagEnd === -1 ? text.length : tagEnd + 1, start: tagStart };
  }
  const lineEnd = text.indexOf("\n", index);
  return { end: lineEnd === -1 ? text.length : lineEnd, start: text.lastIndexOf("\n", index) + 1 };
}

function foundIn(text: string, match: RegExpExecArray, pseudonyms: Pseudonyms): string {
  const { start, end } = surroundings(text, match.index);
  const matchEnd = match.index + match[0].length;
  // Redact first, then cut, so a cut never leaves part of a real value.
  const before = redact(text.slice(start, match.index), pseudonyms).slice(-CONTEXT_LENGTH);
  const after = redact(text.slice(matchEnd, end), pseudonyms).slice(0, CONTEXT_LENGTH);
  return `${before}[value]${after}`.replaceAll(/\s+/gu, " ").trim();
}

/** One leak per field whose real value still appears in the output. Empty when the output is clean. */
function findLeaks(outputs: string[], pseudonyms: Pseudonyms, rules: ScrubRules): Leak[] {
  const text = withoutSiteWords(withoutStandIns(outputs.join("\n"), pseudonyms.standIns()), rules);
  const leaks = new Map<string, Leak>();
  for (const { field, original } of longOriginals(pseudonyms)) {
    const match = leaks.has(field) ? null : wordPattern(original).exec(text);
    if (match !== null) {
      leaks.set(field, { field, foundIn: foundIn(text, match, pseudonyms) });
    }
  }
  return [...leaks.values()];
}

export type { Leak };
export { findLeaks, redact };
