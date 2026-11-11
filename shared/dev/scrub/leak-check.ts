// The last step of a capture. Refuses the output when any replaced value of three or
// more characters still appears in it, kept words included. Names the field, never the value.
// A value counts when it appears as a whole word, ignoring case.
import type { Pseudonyms } from "./pseudonyms.ts";

const MIN_LEAK_LENGTH = 3;

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

/** The fields whose real value still appears in the output. Empty when the output is clean. */
function findLeaks(outputs: string[], pseudonyms: Pseudonyms): string[] {
  const text = withoutStandIns(outputs.join("\n"), pseudonyms.standIns());
  const leakedFields = longOriginals(pseudonyms)
    .filter(({ original }) => wordPattern(original).test(text))
    .map(({ field }) => field);
  return [...new Set(leakedFields)];
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

export { findLeaks, redact };
