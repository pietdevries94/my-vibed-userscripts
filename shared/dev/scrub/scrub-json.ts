// Scrubs a JSON value: keys stay, values become consistent stand-ins.
// Booleans and null stay. The script's keepJsonPaths rules keep matching values.
import { scrubLink, scrubValue } from "./scrub-value.ts";
import type { Pseudonyms } from "./pseudonyms.ts";
import type { ScrubRules } from "./rules.ts";

interface JsonContext {
  rules: ScrubRules;
  pseudonyms: Pseudonyms;
}

function isKept(path: string, value: string, rules: ScrubRules): boolean {
  return rules.keepJsonPaths.some((kept) => kept.path.test(path) && kept.value.test(value));
}

function scrubString(value: string, path: string, context: JsonContext): string {
  if (isKept(path, value, context.rules)) {
    return value;
  }
  return /^https?:\/\//iu.test(value)
    ? scrubLink(value, path, context)
    : scrubValue(value, path, context);
}

function scrubNumber(value: number, path: string, context: JsonContext): number {
  return isKept(path, String(value), context.rules)
    ? value
    : context.pseudonyms.number(value, path);
}

function scrubJsonAt(value: unknown, path: string, context: JsonContext): unknown {
  if (typeof value === "string") {
    return scrubString(value, path, context);
  }
  if (typeof value === "number") {
    return scrubNumber(value, path, context);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => scrubJsonAt(item, path, context));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        scrubJsonAt(child, path === "" ? key : `${path}.${key}`, context),
      ]),
    );
  }
  // Booleans and null carry no names. Anything else does not survive JSON.
  return typeof value === "boolean" || value === null ? value : null;
}

function scrubJson(value: unknown, rules: ScrubRules, pseudonyms: Pseudonyms): unknown {
  return scrubJsonAt(value, "", { pseudonyms, rules });
}

export { scrubJson };
