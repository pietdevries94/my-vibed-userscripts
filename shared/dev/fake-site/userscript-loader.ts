// The init script of the `fake-site` browser: the GM shim, and a loader that adds the
// dev file to every fake-site page once the DOM is there, as Violentmonkey does at
// document-end. GM_addStyle adds a <style>; GM_registerMenuCommand does nothing;
// GM_getValue and GM_setValue keep values in memory, so every page load starts at the defaults.

/** The init script's source, for a dev file served at `devFileUrl`. Runs on `fakeSiteOrigin` only. */
function userscriptLoaderScript(devFileUrl: string, fakeSiteOrigin: string): string {
  return `if (location.origin === ${JSON.stringify(fakeSiteOrigin)}) {
  globalThis.GM_addStyle = (css) => {
    const style = document.createElement("style");
    style.textContent = css;
    (document.head ?? document.documentElement).append(style);
    return style;
  };
  globalThis.GM_registerMenuCommand = () => "";
  const gmValues = new Map();
  globalThis.GM_getValue = (key, defaultValue) => (gmValues.has(key) ? gmValues.get(key) : defaultValue);
  globalThis.GM_setValue = (key, value) => gmValues.set(key, value);
  document.addEventListener("DOMContentLoaded", () => {
    const script = document.createElement("script");
    script.src = ${JSON.stringify(devFileUrl)} + "?t=" + Date.now();
    document.head.append(script);
  });
}
`;
}

export { userscriptLoaderScript };
