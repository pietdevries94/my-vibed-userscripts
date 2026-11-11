# What Violentmonkey offers a userscript: research

Researched 2026-11-11. Scope: running the Azure DevOps script as a Violentmonkey userscript in Zen (Firefox), in place of the MV3 content-script extension. Builds on [pr-pipeline-status.md](pr-pipeline-status.md) sections 1 and 3.

Source shorthand:

- **VM docs**: [violentmonkey.github.io](https://violentmonkey.github.io/).
- **VM source**: [violentmonkey/violentmonkey](https://github.com/violentmonkey/violentmonkey) at tag `v2.50.0`. This is the version on AMO, published 2026-10-26 ([AMO API](https://addons.mozilla.org/api/v5/addons/addon/violentmonkey/), [releases](https://github.com/violentmonkey/violentmonkey/releases)). Every source claim below was checked against that tag.

## Summary

- **Violentmonkey is an MV2 extension.** Its manifest has `manifest_version: 2` and one content script on `<all_urls>` at `document_start` ([manifest.yml](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/manifest.yml)). A userscript runs either as a page script or inside that MV2 content script. Neither is the MV3 content-script context the extension uses now.
- **Two injection modes.** `page`: the script is a normal page script. `content`: it runs in the extension's isolated world. Default is `auto`: page if possible, content if the page's CSP blocks it ([@inject-into](https://violentmonkey.github.io/api/metadata-block/#inject-into)).
- **Firefox decides the mode from the CSP response header.** If `script-src` has a nonce, VM reuses it and stays in page mode. If inline scripts are forbidden and there is no nonce, VM forces content mode ([preinject-core.js L272-L300](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/preinject-core.js#L272-L300)). Which case Azure DevOps falls in was not verified. The script can read the result from `GM_info.injectInto` ([inject-into post](https://violentmonkey.github.io/posts/inject-into-context/)).
- **`fetch` differs per mode.** In page mode it is the page's `fetch`: relative URLs work and same-origin requests send cookies by default ([MDN RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials)). In content mode in Firefox MV2, requests "happen in the context of an extension, so you must provide an absolute URL" ([MDN Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). Cookie behaviour in that mode is unverified.
- **CSS.** No manifest equivalent. Use `GM_addStyle(css)`. VM's content script creates the `<style>` element and adds the page's nonce when it has one ([gm-api.js L177-L183](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/injected/web/gm-api.js#L177-L183), [gm-api-content.js L41-L50](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/injected/content/gm-api-content.js#L41-L50)).
- **Install.** Navigating to any URL ending in `.user.js` opens the installer. `raw.githubusercontent.com/{user}/{repo}/{ref}/{file}.user.js` and `github.com/{user}/{repo}/releases/latest/download/{file}.user.js` are on the direct-install list ([tab-redirector.js L55-L68](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/tab-redirector.js#L55-L68)).
- **Update.** Checked daily at 12:00 local time by default, and on manual request. An update installs only when the remote `@version` is higher. No `@version` means no automatic update ([@version](https://violentmonkey.github.io/api/metadata-block/#version), [update.js L142-L157](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L142-L157)).
- **Dev loop.** Serve the built file on `http://localhost`, open it, click "Track external edits". VM polls the URL every 500 ms and reinstalls on change, with optional tab reload ([editor guide](https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/)).
- **One file.** A userscript is a single script. ES modules do not work. TypeScript must be bundled first ([creating a userscript](https://violentmonkey.github.io/guide/creating-a-userscript/)). No size limit is documented.

---

## 1. The metadata block

Format rules ([Metadata Block](https://violentmonkey.github.io/api/metadata-block/)):

- First line `// ==UserScript==`, last line `// ==/UserScript==`. Every line starts with `//` and exactly one space.
- Put the block at the very beginning of the file. The bundler must emit it as a banner and must not strip or move it.
- `@name` is required. `@namespace` plus `@name` is the script's identity. Installing a script with the same pair replaces the existing one.

| Key            | What it does                                                                                                                                                                                                            | Source                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@match`       | URL pattern where the script runs. Repeatable. Chrome match-pattern syntax on scheme, host and path. Query string and hash are ignored.                                                                                 | [Matching](https://violentmonkey.github.io/api/matching/)                                                       |
| `@grant`       | Lists the `GM_*`/`GM.*` APIs the script may use. Repeatable. `@grant none` disables the sandbox and all GM APIs. With no `@grant` at all (since 2.32.0) the script is sandboxed with `GM_info` and `unsafeWindow` only. | [@grant](https://violentmonkey.github.io/api/metadata-block/#grant)                                             |
| `@run-at`      | `document-start`, `document-body`, `document-end` (default, at `DOMContentLoaded`), `document-idle` (after `DOMContentLoaded`, asynchronously).                                                                         | [@run-at](https://violentmonkey.github.io/api/metadata-block/#run-at)                                           |
| `@require`     | URL of a script to run before this one. Downloaded at install. May be relative to the install URL. Local files not allowed.                                                                                             | [@require](https://violentmonkey.github.io/api/metadata-block/#require)                                         |
| `@resource`    | `name url`. A static file downloaded at install. Read with `GM_getResourceText(name)` or `GM_getResourceURL(name)`. URL may be relative to the install URL.                                                             | [@resource](https://violentmonkey.github.io/api/metadata-block/#resource)                                       |
| `@version`     | Dot-separated parts, each starting with digits. Used for update comparison. Without it "the script will not be updated automatically".                                                                                  | [@version](https://violentmonkey.github.io/api/metadata-block/#version)                                         |
| `@downloadURL` | "The URL the script can be downloaded from. Checked for updates automatically at a regular interval, and also manually on user request. Automatically added when using 'Install from URL.'"                             | [@downloadURL](https://violentmonkey.github.io/api/metadata-block/#downloadurl)                                 |
| `@updateURL`   | Not listed on the docs page. The source reads it: the version check goes to `updateURL`, the download to `downloadURL`.                                                                                                 | [script.js L94-L106](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/script.js#L94-L106) |
| `@inject-into` | `page`, `content` or `auto` (default). See section 5.                                                                                                                                                                   | [@inject-into](https://violentmonkey.github.io/api/metadata-block/#inject-into)                                 |
| `@noframes`    | Run in the top document only.                                                                                                                                                                                           | [@noframes](https://violentmonkey.github.io/api/metadata-block/#noframes)                                       |

Details that matter here:

- **`@match` and the SPA.** VM injects only on a hard navigation, not on `history.pushState`. The docs say to match the whole site and watch for URL changes in the script ([Matching: SPA sites](https://violentmonkey.github.io/api/matching/#matching-spa-sites-like-fb-github-twitter-youtube)). The extension's patterns `https://dev.azure.com/*` and `https://*.visualstudio.com/*` carry over as two `@match` lines.
- **URL resolution for updates.** `downloadURL = custom.downloadURL || meta.downloadURL || custom.lastInstallURL`. `updateURL = custom.updateURL || meta.updateURL || downloadURL` ([script.js L101-L102](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/script.js#L101-L102)). `lastInstallURL` is the URL the script was installed from, stored for any http(s) URL including localhost ([db.js L709](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/db.js#L709)). So both keys are optional when installing from the GitHub URL. Setting `@downloadURL` makes the update source independent of how the script was installed.
- **Separate `@updateURL` is optional.** When `updateURL` equals `downloadURL` and the response contains code, VM uses that response as the new script. No second request ([update.js L148-L151](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L148-L151)).
- **`@run-at document-idle`** matches the extension's `run_at: document_idle`.
- **`@top-level-await`** (since 2.19.2) enables top-level `await`. Not needed for an IIFE bundle ([@top-level-await](https://violentmonkey.github.io/api/metadata-block/#top-level-await)).

## 2. Install and auto-update from GitHub

### What triggers the installer

- VM intercepts main-frame GET requests to `*://*/*.user.js` and `*.user.js?*`. In Firefox it cancels the request and opens its confirm page ([tab-redirector.js L124-L156](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/tab-redirector.js#L124-L156)).
- The file name must end in `.user.js`.
- URL forms on the direct-install list, where VM opens the installer without first checking the content ([tab-redirector.js L55-L68](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/tab-redirector.js#L55-L68)):

| Form                                                                       | Note                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `https://raw.githubusercontent.com/{user}/{repo}/{ref}/{file}.user.js`     | Exactly three path segments before the file. The file sits in the repo root. |
| `https://github.com/{user}/{repo}/raw/{ref}/{file}.user.js`                | One segment after `raw/`. Repo root only.                                    |
| `https://github.com/{user}/{repo}/releases/latest/download/{file}.user.js` | Release asset, always the latest release.                                    |
| `https://github.com/{user}/{repo}/releases/download/{tag}/{file}.user.js`  | Release asset of one tag.                                                    |
| `https://gist.github.com/.../{file}.user.js`                               |                                                                              |

- Other `raw.githubusercontent.com` URLs (a file in `dist/`, or a `refs/heads/{branch}` path) are not on the list and not on the block list. VM then fetches the URL and opens the installer if the content parses as a userscript with a `@name` ([tab-redirector.js L80-L99](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/tab-redirector.js#L80-L99)).
- Other `github.com` URLs are on the block list and are not intercepted ([L69-L72](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/tab-redirector.js#L69-L72)). That covers `github.com/{user}/{repo}/blob/...` pages and `raw/{ref}/dist/...` paths.
- The dashboard also has "Install from URL", which adds `@downloadURL` handling automatically ([@downloadURL](https://violentmonkey.github.io/api/metadata-block/#downloadurl)).
- `@require` and `@resource` files are downloaded during installation ([@require](https://violentmonkey.github.io/api/metadata-block/#require), [@resource](https://violentmonkey.github.io/api/metadata-block/#resource)).

### When it checks

- Default schedule is the cron expression `0 12 * * *`: daily at 12:00 local time ([cron.js](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/cron.js), [options-defaults.js L42](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/options-defaults.js#L42)). The settings page offers Disabled, Daily, or a custom five-field cron expression ([tab-settings](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/options/views/tab-settings/index.vue)).
- If an occurrence was missed while the browser was closed, the check runs 20 s after startup ([update.js L24, L229-L232](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L229-L232)).
- Manual: from the dashboard or popup, and through the extension commands `updateScripts` and `updateScriptsInTab` ([manifest.yml](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/manifest.yml)).
- The scheduled check skips disabled scripts by default (`updateEnabledScriptsOnly: true`) and scripts with per-script updates turned off ([options-defaults.js L36](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/options-defaults.js#L36), [script.js L95-L96](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/script.js#L95-L96)).

### What triggers an update

- VM requests `updateURL` with `cache: 'no-cache'` and `Accept: text/x-userscript-meta,*/*`, parses the metadata, and compares versions ([update.js L18-L22, L142-L144](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L142-L144)).
- If the installed version is equal or higher: no update. Otherwise the new code is installed ([update.js L144-L157](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L144-L157)). Changing the file without raising `@version` does nothing.
- A scheduled check first sends a `HEAD` request and compares `ETag`, `Last-Modified` or `Date` with the stored value. If unchanged, it stops there ([storage-fetch.js L51-L85](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/storage-fetch.js#L51-L85)).
- The update installs without a confirm page: the checker calls `parseScript` directly ([update.js L98-L111](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/update.js#L98-L111)). Update notifications are off by default (`notifyUpdates: false`, [options-defaults.js](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/options-defaults.js)).
- A running tab keeps the old code until its next hard navigation, since injection happens on page load (section 1, SPA note).

## 3. Styling

- The extension ships `content.css` through `content_scripts.css` in the manifest ([build.mjs](../../scripts/build.mjs)). A userscript has no such slot. It must add a `<style>` element at runtime.
- `GM_addStyle(css)` "appends and returns a `<style>` element with the specified CSS" ([GM_addStyle](https://violentmonkey.github.io/api/gm/#gm_addstyle)). Needs `// @grant GM_addStyle`.
- How it works: the call crosses to VM's content script, which creates the element, sets the nonce attribute if VM captured one, and appends it to `<head>` ([gm-api.js L177-L183](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/injected/web/gm-api.js#L177-L183), [gm-api-content.js L41-L50](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/injected/content/gm-api-content.js#L41-L50)). The source comment on `GM_addStyle` reads "Bypasses site's CSP for inline `style`".
- `GM_addElement` exists for the same purpose: "circumventing a strict Content-Security-Policy that forbids adding inline code or style" ([GM_addElement](https://violentmonkey.github.io/api/gm/#gm_addelement)).
- Can CSP block it? A `<style>` element the script creates itself in page mode is an ordinary inline style and is subject to the page's `style-src`. `GM_addStyle` avoids that by creating the element from the content script. Two caveats:
  - The nonce VM reuses is taken from `script-src`/`default-src`, not `style-src` ([preinject-core.js L51-L52, L282-L300](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/preinject-core.js#L272-L300)).
  - VM carries a Firefox workaround "to circumvent CSP style-src" that refers to [bug 1706787](https://bugzilla.mozilla.org/show_bug.cgi?id=1706787) ([content/util.js L17](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/injected/content/util.js#L17)). The bug is open (status REOPENED).
- Where the CSS text comes from. Two options:
  - Bundle it into the script as a string. One file, one request, CSS and code always update together.
  - `@resource css ./content.css` plus `GM_getResourceText('css')` ([GM_getResourceText](https://violentmonkey.github.io/api/gm/#gm_getresourcetext)). Keeps a separate file. Adds a second download and a second grant.
- Any `GM_*` grant turns the sandbox on: the script's `window` becomes a wrapper, and page globals need `unsafeWindow` ([unsafeWindow](https://violentmonkey.github.io/api/gm/#unsafewindow)). The script uses only DOM APIs, so this has no effect on it.
- Timing: the style is added when the script runs. With `@run-at document-idle` that is after `DOMContentLoaded`. The styled elements are created by the script, so nothing is shown unstyled.

## 4. Requests

- **Page mode.** The script is a page script. `fetch` is the page's own. A relative URL resolves against the page. `credentials` defaults to `same-origin`: "Only send and include credentials for same-origin requests" ([MDN RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials)). A GET to `/_apis/...` carries the session cookie of that tab, including a container tab. This is the mode [unfuck-ado](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/banner.txt) uses (`@inject-into page`, see pr-pipeline-status.md section 3).
- **Content mode.** The script runs in VM's content script. VM is MV2. MDN: "In Firefox in Manifest V2, content script requests (for example, using `fetch()`) happen in the context of an extension, so you must provide an absolute URL to reference page content." Requests made this way do not set `Origin` and `Referer` "like a request from the page itself would" ([MDN Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). So relative URLs are unsafe in content mode. Whether such a request sends the tab's session cookie is unverified.
- This differs from the current extension. An MV3 content script's requests "happen in context of the page" ([same page](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). The existing code's relative-URL `fetch` is only equivalent in page mode.
- **`GM_xmlhttpRequest`** "makes a request like XMLHttpRequest, with some special capabilities, not restricted by same-origin policy" ([GM_xmlhttpRequest](https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)).
  - Cookies are sent unless `anonymous: true` ([same page](https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)).
  - In Firefox, VM reads the cookies itself from the cookie store of the calling tab and sets the `Cookie` header. A container tab's store is used ([requests.js L126-L176](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/requests.js#L126-L176)).
  - It is callback-based, runs through the background page, and needs `// @grant GM_xmlhttpRequest`.
- **When `GM_xmlhttpRequest` is needed.** For cross-origin requests the server does not allow through CORS. For same-origin GETs it is needed only if the script ends up in content mode and plain `fetch` with an absolute URL does not carry the session. In page mode it is not needed.
- Build request URLs from `location.origin` in every mode. That is valid in both, and the MDN note requires it in content mode.

## 5. Injection modes and sandboxing

Two separate axes.

### Context: `@inject-into`

|                       | `page`                                                                            | `content`                                                          |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Runs as               | A script of the web page                                                          | A script in VM's content-script world, "a secure 'isolated world'" |
| DOM                   | Full access                                                                       | Full access                                                        |
| Page's JS objects     | Yes, through `unsafeWindow`                                                       | No. In Firefox reachable through `wrappedJSObject`                 |
| Strict CSP in Firefox | "Injection fails in Firefox on sites with strict CSP that forbids inline scripts" | Works                                                              |

Source: [inject-into post](https://violentmonkey.github.io/posts/inject-into-context/), [@inject-into](https://violentmonkey.github.io/api/metadata-block/#inject-into).

- `auto` (default): page if possible, content if blocked by CSP. "It is the script author's job to check the environments" ([inject-into post](https://violentmonkey.github.io/posts/inject-into-context/)).
- The user can change the default mode in VM's settings, and per script ([@inject-into](https://violentmonkey.github.io/api/metadata-block/#inject-into), [@run-at note](https://violentmonkey.github.io/api/metadata-block/#run-at)). The shipped default is `auto` ([options-defaults.js L73](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/options-defaults.js#L73)).
- How Firefox picks, for https pages ([preinject-core.js L272-L300](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/preinject-core.js#L272-L300)):
  - No CSP header, or no `script-src`/`script-src-elem`/`default-src` in it: page mode.
  - A `'nonce-...'` in those directives: VM puts the same nonce on its own `<script>` and stays in page mode.
  - No nonce and no `'unsafe-inline'`: content mode is forced. Scripts with `@inject-into page` then do not run.
  - With the advanced setting "Bypass CSP in Firefox" (`ffCsp`, off by default), VM instead rewrites the header to add its own nonce and stays in page mode ([options-defaults.js L74](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/options-defaults.js#L74)).
- `GM_info.injectInto` tells the script which mode it got ([inject-into post](https://violentmonkey.github.io/posts/inject-into-context/)).
- What the script uses is available in both contexts: DOM, `MutationObserver`, `location`, `sessionStorage`. The docs show `window.location` and DOM access as "shared in both contexts" ([inject-into post](https://violentmonkey.github.io/posts/inject-into-context/)). A content script "can read and modify page content using the standard Web APIs" ([MDN Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)).
- Patching `history.pushState` only affects the page in page mode. The observer-plus-URL-comparison approach from pr-pipeline-status.md section 5 works in both. The VM docs recommend the same pattern, with `navigation.addEventListener('navigatesuccess', ...)` where available ([Matching: SPA sites](https://violentmonkey.github.io/api/matching/#matching-spa-sites-like-fb-github-twitter-youtube)).

### Sandbox: `@grant`

- With any grant, or no `@grant` line: sandboxed. The script's `window` is a wrapper "that confines modifications like `window.foo = 123` to this script's scope". `unsafeWindow` is the real one ([unsafeWindow](https://violentmonkey.github.io/api/gm/#unsafewindow)).
- With `@grant none`: no sandbox, no GM APIs. The script "can add/modify globals directly" ([@grant](https://violentmonkey.github.io/api/metadata-block/#grant)).
- VM wraps the script in a function. `@unwrap` (since 2.13.1) injects it as-is into the page's global scope and ignores `@grant` ([@unwrap](https://violentmonkey.github.io/api/metadata-block/#unwrap)).

## 6. The local dev loop

Source: [How to edit scripts with your favorite editor](https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/).

- **Local server (works in Firefox).** Serve the build output and open `http://localhost:{port}/{name}.user.js`. The installer opens. Click "Track external edits". "Make sure the hostname is localhost and the script name ends with `.user.js`."
- While the installer tab stays open, VM re-reads the URL and reinstalls on change. The loop polls every 500 ms ([confirm/app.vue L465-L490](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/confirm/views/app.vue#L465-L490)).
- The "Reload tab" option reloads the active tab when it matches the script.
- Tracking is offered for local URLs only: `file:`, `localhost`, `127.0.0.1`, and private ranges ([util.js `isLocalUrlRe`](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/util.js)).
- The docs suggest `http-server -c5` or `-c-1` so the server does not cache.
- **Local file.** Drag the `.user.js` file into the tab bar. In Firefox: "don't close the tab of this file while tracking as it's used to read the contents of the file."
- **Dragging into a VM page** is Chrome only.
- **Limits in Firefox.**
  - "Firefox may throttle detection: the older the file is, the longer it takes to detect the changes."
  - Tracking stops when the installer tab closes.
  - `@require` cannot point at a local file ([@require](https://violentmonkey.github.io/api/metadata-block/#require)).
  - A localhost install stores that URL as `lastInstallURL` ([db.js L709](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/background/utils/db.js#L709)). Without `@downloadURL`, update checks would then go to localhost. Set `@downloadURL` in the metadata.
  - The dev build and the release build replace each other if they share `@namespace` and `@name` ([@name](https://violentmonkey.github.io/api/metadata-block/#name)). Give the dev build its own `@name` to keep both, as the extension does with its two ids.
- Scripts live in the extension's storage, not as files on disk ([FAQ](https://violentmonkey.github.io/faq/)). The build output is the source of truth.
- The VM docs describe a watch build for this loop: `npm run dev` compiles to `dist` on change ([Modern Syntax](https://violentmonkey.github.io/guide/using-modern-syntax/)).

## 7. Size and structure limits of one `.user.js`

- The code runs directly in the browser. Syntax must be natively supported. "ES modules won't work in userscripts because they are supposed to inject into webpage as single-file scripts" ([creating a userscript](https://violentmonkey.github.io/guide/creating-a-userscript/)).
- TypeScript and ES modules must be compiled and bundled first ([Modern Syntax](https://violentmonkey.github.io/guide/using-modern-syntax/)). The current esbuild `format: "iife"` output fits.
- The metadata block must be at the top of the output, in line comments (section 1). A minifier must keep it.
- Top-level `await` needs `@top-level-await`. It cannot be combined with `@unwrap` ([@top-level-await](https://violentmonkey.github.io/api/metadata-block/#top-level-await)).
- Size: the docs state no limit. VM's manifest requests `unlimitedStorage` ([manifest.yml](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/manifest.yml)). A search of the source for size checks on script code found none. The FAQ treats 100 KB as "smaller than size of a feature-rich script" ([FAQ](https://violentmonkey.github.io/faq/)).
- For scripts that take more than a few milliseconds to compile and run, the docs recommend `@run-at document-idle` ([@run-at](https://violentmonkey.github.io/api/metadata-block/#run-at)).

---

## What this means for the move from the extension

Carries over unchanged:

- The esbuild IIFE bundle of `src/content.ts`.
- `MutationObserver`, `sessionStorage`, `location.reload()`, DOM rendering. Available in both injection modes.
- The match patterns, as `@match` lines.
- `document_idle` timing, as `@run-at document-idle`.
- Same-origin GET with the session cookie, provided the script runs in page mode.
- The dev/release split: a localhost build and a GitHub build, with different `@name`s.

Must change:

- `manifest.json` goes. A metadata block banner replaces it: `@name`, `@namespace`, `@version` (from `package.json`), `@match`, `@run-at`, `@grant`, `@downloadURL`.
- `content.css` can no longer ship through the manifest. Inline it into the bundle and apply it with `GM_addStyle` (`@grant GM_addStyle`).
- Request URLs must be absolute (`location.origin + path`). Relative URLs are only safe in page mode.
- The injection mode is no longer fixed. Either set `@inject-into page` and accept that the script does not run if Firefox blocks page injection, or leave `auto` and handle content mode. Log `GM_info.injectInto` in the first version to learn which mode Azure DevOps gives.
- If content mode turns out to be the result and `fetch` does not carry the session there, switch the API client to `GM_xmlhttpRequest`. Keep the fetch call behind one function so this is a one-place change.
- Releases need a `@version` bump. Without it, installed copies never update.
- The output file name must end in `.user.js`. For the shortest install URL, publish it in the repo root or as a release asset (`releases/latest/download/`).
- No signing, no AMO, no `gecko.id`, no `web-ext`. Install is one click on the raw URL. Updates arrive within a day, or on "check for updates".
- Dev reload changes from `web-ext`-style extension reload to VM's "Track external edits" on a localhost URL, with the installer tab kept open.

## Unverified

1. Which injection mode a userscript gets on Azure DevOps in Firefox. It depends on the site's `Content-Security-Policy` response header, which was not read (no signed-in session; the unauthenticated root returns 404 without it). Check `GM_info.injectInto` on a live page.
2. Whether a plain `fetch` to an absolute same-origin URL from a content-mode userscript in Firefox sends the tab's session cookie, including in a container tab. MDN only says such requests "happen in the context of an extension".
3. Which `fetch` a sandboxed content-mode script resolves to (the content script's or the page's Xray-wrapped one). Not traced through VM's global wrapper.
4. Whether Azure DevOps' `style-src` would block a `<style>` element added without `GM_addStyle`, and whether `GM_addStyle` succeeds there in page mode when the nonce comes from `script-src`. The source comment claims a CSP bypass. Not tested.
5. Exact behaviour behind Firefox bug 1706787 in current Firefox/Zen. Only the bug title and status were read.
6. That a `github.com/.../raw/{ref}/dist/x.user.js` link still ends in the installer after GitHub redirects it to `raw.githubusercontent.com`. Inferred from the request filter. Not tested.
7. How long `raw.githubusercontent.com` serves a stale file after a push. No GitHub primary source was read. VM sends `cache: 'no-cache'`.
8. `@connect`. The source parses it as a list ([userscript-meta.js](https://github.com/violentmonkey/violentmonkey/blob/v2.50.0/src/common/userscript-meta.js)). The docs do not list it. No enforcement was found in `requests.js`, but the search was not exhaustive.
9. A hard size limit for one script. None documented and none found. The absence was not proven.
10. Whether Zen changes anything about Violentmonkey's behaviour compared with Firefox. The earlier research found no documented extension API differences. Not tested.
11. Whether the "Track external edits" throttling in Firefox applies to localhost URLs or only to `file:` URLs. The docs do not say.
