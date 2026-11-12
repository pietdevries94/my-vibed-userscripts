// Masks real values in text the scrubber does not walk, such as error messages and stacks.
import type { Pseudonyms } from "./pseudonyms.ts";
import { escapeRegExp } from "./word-pattern.ts";

/** Shorter values match too much ordinary text. */
const MIN_REDACTED_LENGTH = 3;

/** `text` with every replaced value of three or more characters swapped for "[scrubbed]". */
function redact(text: string, pseudonyms: Pseudonyms): string {
  const originals = pseudonyms
    .replaced()
    .map(({ original }) => original.trim())
    .filter((original) => original.length >= MIN_REDACTED_LENGTH)
    .toSorted((left, right) => right.length - left.length);
  let redacted = text;
  for (const original of originals) {
    redacted = redacted.replaceAll(new RegExp(escapeRegExp(original), "giu"), "[scrubbed]");
  }
  return redacted;
}

export { redact };
