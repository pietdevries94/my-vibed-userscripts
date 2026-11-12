function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** Matches `value` as a whole word, ignoring case. Letters and digits around it make it part of a longer word. */
function wordPattern(value: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, "giu");
}

export { escapeRegExp, wordPattern };
