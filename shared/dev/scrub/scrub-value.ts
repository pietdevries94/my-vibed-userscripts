// Replaces one value with a consistent stand-in, by what the value looks like.
import type { Pseudonyms } from "./pseudonyms.ts";
import type { ScrubRules } from "./rules.ts";

const GUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/u;
const DIGITS = /^\d+$/u;
const LINK_BASE = "https://site.invalid";
/** Values that carry no names: empty, and booleans written as text. */
const KEPT_VALUES = new Set(["", "true", "false"]);

function scrubValue(
  value: string,
  field: string,
  context: { rules: ScrubRules; pseudonyms: Pseudonyms },
): string {
  const trimmed = value.trim();
  if (KEPT_VALUES.has(trimmed) || context.rules.keepUiWords.includes(trimmed)) {
    return value;
  }
  if (DIGITS.test(trimmed)) {
    return String(context.pseudonyms.number(Number(trimmed), field));
  }
  if (GUID.test(trimmed)) {
    return context.pseudonyms.guid(trimmed, field);
  }
  if (ISO_DATE.test(trimmed)) {
    return context.pseudonyms.date(trimmed, field);
  }
  return value.replace(trimmed, context.pseudonyms.text(trimmed, field));
}

function isRouteWord(segment: string, rules: ScrubRules): boolean {
  return /^_[A-Za-z]+$/u.test(segment) || rules.keepRouteWords.includes(segment);
}

function parseLink(link: string): URL | null {
  try {
    return new URL(link, LINK_BASE);
  } catch {
    return null;
  }
}

function routeShape(
  url: URL,
  field: string,
  context: { rules: ScrubRules; pseudonyms: Pseudonyms },
): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const scrubbed = segments.map((segment) =>
    isRouteWord(segment, context.rules)
      ? segment
      : scrubValue(decodeURIComponent(segment), field, context),
  );
  return `/${scrubbed.join("/")}`;
}

/**
 * A link or image URL as a path of stand-ins. The script's mapUrl rule goes first;
 * otherwise route words stay and every other segment is replaced. Query and hash are dropped.
 */
function scrubLink(
  link: string,
  field: string,
  context: { rules: ScrubRules; pseudonyms: Pseudonyms },
): string {
  if (link.startsWith("data:")) {
    return "data:";
  }
  const url = parseLink(link);
  if (url === null) {
    return "#";
  }
  return context.rules.mapUrl(url, context.pseudonyms) ?? routeShape(url, field, context);
}

export { GUID, scrubLink, scrubValue };
