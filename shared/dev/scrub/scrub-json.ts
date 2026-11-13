// Scrubs a JSON value: values become consistent stand-ins, and so do keys that hold
// values, such as a GUID or a name used as a key. Field names stay. Booleans and null
// stay. The script's keepJsonPaths rules keep matching values.
import { GUID, scrubLink, scrubValue } from "./scrub-value.ts";
import type { Pseudonyms } from "./pseudonyms.ts";
import type { ScrubRules } from "./rules.ts";

interface JsonContext {
  rules: ScrubRules;
  pseudonyms: Pseudonyms;
}

/** A field name, such as `displayName`, `ms.vss-web.theme-data` or `Hierarchy-Forward`. */
const FIELD_NAME = /^[A-Za-z_$][\w$.-]{0,80}$/u;
/** Keys such as settings paths join field names and values with slashes. */
const KEY_SEPARATOR = "/";

function scrubKeyPart(part: string, path: string, context: JsonContext): string {
  const isFieldName = FIELD_NAME.test(part) && !GUID.test(part);
  // A stand-in the capture code chose already, such as a pull request id.
  const isStandIn = context.pseudonyms.standIns().includes(part);
  return isFieldName || isStandIn || part === "" ? part : scrubValue(part, path, context);
}

function scrubKey(key: string, path: string, context: JsonContext): string {
  return key
    .split(KEY_SEPARATOR)
    .map((part) => scrubKeyPart(part, path, context))
    .join(KEY_SEPARATOR);
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
      Object.entries(value).map(([key, child]) => {
        const scrubbedKey = scrubKey(key, path, context);
        const childPath = path === "" ? scrubbedKey : `${path}.${scrubbedKey}`;
        return [scrubbedKey, scrubJsonAt(child, childPath, context)];
      }),
    );
  }
  // Booleans and null carry no names. Anything else does not survive JSON.
  return typeof value === "boolean" || value === null ? value : null;
}

function scrubJson(value: unknown, rules: ScrubRules, pseudonyms: Pseudonyms): unknown {
  return scrubJsonAt(value, "", { pseudonyms, rules });
}

export { scrubJson };
