// Types for what Violentmonkey and the build give a script.

/** Adds a `<style>` with the page's nonce. Needs `@grant GM_addStyle`. */
declare function GM_addStyle(css: string): HTMLStyleElement;

/**
 * Adds a command to the Violentmonkey menu. Needs `@grant GM_registerMenuCommand`;
 * the dev build adds it. A second call with the same `id` replaces the caption.
 */
declare function GM_registerMenuCommand(
  caption: string,
  onClick: () => void,
  options?: { id?: string },
): string;

/** Reads a value this script stored. Needs `@grant GM_getValue`. */
declare function GM_getValue<Value>(key: string, defaultValue: Value): Value;

/** Stores a JSON value for this script. Needs `@grant GM_setValue`. */
declare function GM_setValue(key: string, value: unknown): void;

/** The build inlines a CSS file as text. */
declare module "*.css" {
  const css: string;
  export default css;
}
