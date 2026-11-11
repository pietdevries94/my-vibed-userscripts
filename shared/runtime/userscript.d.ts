// Types for what Violentmonkey and the build give a script.

/** Adds a `<style>` with the page's nonce. Needs `@grant GM_addStyle`. */
declare function GM_addStyle(css: string): HTMLStyleElement;

/** Dev file only. Needs `@grant GM_registerMenuCommand`, which the dev build adds. */
declare function GM_registerMenuCommand(caption: string, onClick: () => void): string;

/** The build inlines a CSS file as text. */
declare module "*.css" {
  const css: string;
  export default css;
}
