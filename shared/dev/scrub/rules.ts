import type { Pseudonyms } from "./pseudonyms.ts";

/**
 * What a script's capture keeps beyond the shared allowlist. Rules only add keeps;
 * everything else is replaced. The owner reads this list in the script's capture.ts.
 */
interface ScrubRules {
  /** Attributes whose values are kept as they are. */
  keepAttributes: string[];
  /** JSON values kept when the path matches and the value matches. Paths join keys with dots; array indexes are left out. */
  keepJsonPaths: { path: RegExp; value: RegExp }[];
  /** Element ids kept as they are. */
  keepIdPatterns: RegExp[];
  /** Link and image path segments kept as they are. Segments that start with "_" are kept too. */
  keepRouteWords: string[];
  /** Exact UI texts kept as they are, such as "Active". */
  keepUiWords: string[];
  /** A fake URL for one of the site's own URLs, or null to fall back to the route shape. */
  mapUrl: (url: URL, pseudonyms: Pseudonyms) => string | null;
}

export type { ScrubRules };
