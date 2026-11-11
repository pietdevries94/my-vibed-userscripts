// The last step of a capture. Refuses the output when any replaced value of three or
// more characters still appears in it, kept words included. A value counts when it
// appears as a whole word, ignoring case. The report names the field, and shows where
// the value was found with the value itself and every other replaced value masked.
import type { Pseudonyms } from "./pseudonyms.ts";

interface Leak {
  /** Where the value was replaced, such as `div.wit-card @data-itemid`. */
  field: string;
  /** The tag or JSON line where it still appears, with the value shown as [value]. */
  foundIn: string;
}

const MIN_LEAK_LENGTH = 3;
const MAX_CONTEXT_LENGTH = 240;

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** Matches `value` as a whole word, ignoring case. */
function wordPattern(value: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, "giu");
}

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
  const before = text.slice(start, match.index);
  const after = text.slice(match.index + match[0].length, end);
  const masked = `${redact(before, pseudonyms)}[value]${redact(after, pseudonyms)}`
    .replaceAll(/\s+/gu, " ")
    .trim();
  return masked.length > MAX_CONTEXT_LENGTH ? `${masked.slice(0, MAX_CONTEXT_LENGTH)}…` : masked;
}

/** One leak per field whose real value still appears in the output. Empty when the output is clean. */
function findLeaks(outputs: string[], pseudonyms: Pseudonyms): Leak[] {
  const text = withoutStandIns(outputs.join("\n"), pseudonyms.standIns());
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
