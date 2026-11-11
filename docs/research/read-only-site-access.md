# Looking at a real site read-only: research

Researched 2026-11-11. Desk research. No browser was launched and nothing below was tested. Sources are the tools' own docs and source code, cited inline.

Source shorthand:

- **PMCP README**: [microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md), `main` on 2026-11-11.
- **PMCP source**: the server code lives in [microsoft/playwright, `packages/playwright-core/src/tools`](https://github.com/microsoft/playwright/tree/main/packages/playwright-core/src/tools), `main` on 2026-11-11.

## Summary

- **No option works in Zen without real setup cost.** Playwright does not drive branded Firefox ([Playwright browsers](https://playwright.dev/docs/browsers)). Playwright MCP's attach modes are Chromium only (PMCP README, `--extension`, `--cdp-endpoint`). Claude in Chrome needs a Chromium browser ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)). Zen can only be driven over Firefox's Remote Agent, which needs a restart with a flag and a client that has to be written ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)).
- **Only Playwright MCP gives a network-level guard.** Its `--init-page` hook receives the Playwright `page` object (PMCP README, "Initial state"). Playwright can abort a request by method through `route` ([Route](https://playwright.dev/docs/api/class-route), [Request.method](https://playwright.dev/docs/api/class-request)). Playwright MCP has no built-in method filter. Its origin lists are documented as "_does not_ serve as a security boundary" (PMCP README).
- **Claude in Chrome has no network-level guard.** Its controls are per-site permissions and approval prompts ([permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)). Anthropic advises against using it for "work accounts with sensitive company data" ([safety article](https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely)).
- **Capture works in Playwright MCP.** `browser_network_request` returns request and response headers and bodies. `browser_evaluate` returns markup. `browser_snapshot` returns an accessibility snapshot (PMCP README, tool list).

**Recommendation.** Keep the Playwright MCP server that is already configured. Use its own browser with the persistent profile as a second browser next to Zen. The owner signs in by hand in that window. Enforce read-only in two layers:

1. Network layer: an `--init-page` script that aborts every request that is not GET or HEAD and closes every WebSocket, plus `--block-service-workers` and `--allowed-origins`.
2. Tool layer: Claude Code `deny` rules for the Playwright tools that click, type, upload, or run arbitrary Playwright code.

Neither layer is complete. See "What still gets through". The network layer has to exempt the identity provider, or sign-in itself breaks (sign-in posts forms).

## Comparison

| Option                                                    | Sign-in (SSO, MFA)                                                               | Agent can read                                                                                  | Read-only enforcement                                                                                                           | Zen or second browser            | Setup cost                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Playwright MCP, own browser, persistent profile (default) | Owner signs in by hand in the MCP window. The profile keeps the session.         | Accessibility snapshot, DOM through `browser_evaluate`, request and response headers and bodies | Network: `--init-page` route that aborts non-GET, `--allowed-origins`, `--block-service-workers`. Tool: Claude Code deny rules. | Second browser                   | Low. Already configured. Add flags, one script, deny rules.           |
| Playwright MCP, `--isolated` plus `--storage-state`       | Cookies and local storage loaded from a file. The file has to be produced first. | Same                                                                                            | Same                                                                                                                            | Second browser                   | Medium. Storage file holds session secrets on disk.                   |
| Playwright MCP, `--extension`                             | Uses the sessions of a running Chrome or Edge. Owner picks the tab.              | Same                                                                                            | Same hooks exist in the source. Not confirmed for this mode.                                                                    | Second browser (Chrome or Edge)  | Low to medium. Install extension, sign in to the site in Chrome.      |
| Playwright MCP, `--cdp-endpoint`                          | Uses a Chromium browser that was started with a debugging port                   | Same, at lower fidelity                                                                         | Same hooks exist in the source. Not confirmed for this mode.                                                                    | Second browser (Chromium family) | Medium. Browser must be started with a debugging port.                |
| Claude in Chrome                                          | Shares the browser's login state. Pauses at login pages and CAPTCHAs.            | Console, network requests, DOM state, page text                                                 | Site permissions and approval prompts in the extension. Claude Code deny rules. No network filter documented.                   | Second browser (Chromium family) | Low. Extension plus `claude --chrome`. Needs a direct Anthropic plan. |
| Zen or Firefox over WebDriver BiDi                        | Owner's own Zen session, if Zen is restarted with `--remote-debugging-port`      | Per spec: DOM through script evaluation, request data, response bodies                          | Per spec: `network.addIntercept` plus `network.failRequest` by method. Client must be written.                                  | Zen (unverified) or Firefox      | High. No ready-made MCP client found. Restart with a flag.            |
| Zen or Firefox over Marionette and geckodriver            | Owner's own session, if started with `--marionette`                              | WebDriver classic: DOM, script execution                                                        | None at network level in WebDriver classic                                                                                      | Zen (unverified) or Firefox      | High                                                                  |

Sources for the table are in the sections below.

## 1. The options

### 1.1 Playwright MCP with its own browser and a persistent profile

This is what the machine runs now: `@playwright/mcp@latest` with no flags (output of `claude mcp get playwright`).

- **Profile.** The default mode is a persistent profile. "All the logged in information will be stored in the persistent profile." On macOS it sits at `~/Library/Caches/ms-playwright/mcp-{channel}-{workspace-hash}`. The hash comes from the MCP client's workspace root, so each project gets its own profile. `--user-data-dir` overrides the location (PMCP README, "User profile").
- **One instance per profile.** "A persistent profile can only be used by one browser instance at a time" (PMCP README, "User profile").
- **Sign-in.** The browser is headed by default (`--headless`: "run browser in headless mode, headed by default", PMCP README). The owner types credentials and completes MFA in that window. The session then lives in the profile. The docs do not describe SSO or MFA handling beyond this.
- **Which browser.** `--browser` accepts `chrome`, `firefox`, `webkit`, `msedge` (PMCP README). `firefox` means Playwright's patched build: "Playwright doesn't work with the branded version of Firefox since it relies on patches" ([Playwright browsers](https://playwright.dev/docs/browsers)).
- **Chrome's own profile cannot be reused.** "Due to recent Chrome policy changes, automating the default Chrome user profile is not supported." Use a separate directory ([BrowserType.launchPersistentContext](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)).
- **Extensions.** The persistent launch passes `ignoreDefaultArgs: ['--disable-extensions']`, which removes Playwright's default `--disable-extensions` argument ([browserFactory.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/mcp/browserFactory.ts), `createPersistentBrowser`). Whether Violentmonkey then loads in that profile was not tested.
- **What it reads.** See section 3.
- **Setup cost.** Low. Add flags to the existing server entry.

### 1.2 Playwright MCP, isolated with a storage state file

- `--isolated` keeps the profile in memory. When the browser closes, "all the storage state for this session is lost". `--storage-state` loads "cookies and local storage from the file into an isolated browser context" (PMCP README, "User profile", "Initial state").
- The file has to come from a signed-in session first. `browser_storage_state` can write one, but only with `--caps=storage` (PMCP README, tool list).
- Cost: session cookies sit in a plain file. Short-lived SSO sessions mean the file goes stale.

### 1.3 Playwright MCP connected to an existing browser

Two modes. Both are Chromium only.

- **`--extension`.** "Connect to a running browser instance (Edge/Chrome only). Requires the 'Playwright Extension' to be installed" (PMCP README). The extension lets the agent "interact with websites where you're already logged in, using your existing cookies, sessions, and browser state" ([extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)).
  - On first use the owner selects the tab the agent connects to. The client "only sees the tabs in that group". Each connection needs approval unless `PLAYWRIGHT_MCP_EXTENSION_TOKEN` is set ([extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)).
  - Prerequisite: "Chrome/Edge/Chromium browser" ([extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)). No Firefox version is documented.
- **`--cdp-endpoint`.** The server calls `playwright.chromium.connectOverCDP` ([browserFactory.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/mcp/browserFactory.ts), `createCDPBrowser`). "Connecting over the Chrome DevTools Protocol is only supported for Chromium-based browsers." The connection "is significantly lower fidelity than the Playwright protocol connection" ([BrowserType.connectOverCDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)).
- Firefox dropped CDP. The Remote Agent docs say: "With the end of the CDP support, WebDriver BiDi is the only available protocol" ([Remote protocol preferences](https://firefox-source-docs.mozilla.org/remote/Prefs.html)). So `--cdp-endpoint` cannot target Zen or Firefox.

### 1.4 Claude in Chrome

- **Browsers.** "Chrome integration works with Google Chrome and Microsoft Edge." Claude Code also sets up the connection in Brave, Arc, Vivaldi, and Opera ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)). The support article says the extension "is not supported on other Chromium-based web browsers" ([getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)). The two pages disagree on non-Chrome Chromium browsers. Neither lists Firefox.
- **Sign-in.** Claude "shares your browser's login state, so it can access any site you're already signed into". "When Claude encounters a login page or CAPTCHA, it pauses and asks you to handle it manually" ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)).
- **What it reads.** "Read console errors and DOM state directly" ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)). "Claude can now read browser console output, including errors, network requests, and DOM state" ([getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)). The docs do not say whether response bodies are available.
- **Controls.** Site permissions are managed in the extension and decide "which sites Claude can browse, click, and type on" ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)). The permissions guide describes a Manual mode, per-action and per-site approval, and a list of actions that always need approval or are always blocked ([permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)). No read-only mode is documented.
- **Vendor advice.** "We strongly advise against using Claude in Chrome to manage or take actions on sensitive information". The list of things to avoid includes "Accessing work accounts with sensitive company data" ([safety article](https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely)).
- **Setup cost.** Install the extension (1.0.36 or later), start with `claude --chrome`. Requires a direct Anthropic plan and `/login`. Not available with an API key or through Bedrock, Google Cloud, or Foundry ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)).

### 1.5 Firefox or Zen over WebDriver BiDi or Marionette

- **Protocols.** Firefox supports Marionette and WebDriver BiDi ([remote protocols](https://firefox-source-docs.mozilla.org/remote/index.html)).
- **Enabling.** The Remote Agent "can only be started by passing the `--remote-debugging-port` flag". It defaults to `localhost:9222` and only accepts loopback connections ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)). The browser has to be started with the flag. The docs describe no way to switch it on in a running browser.
- **No authentication.** The Remote Agent "does not provide any authentication system". The interfaces "give the client access to all browser internals, and thereby follows all browser-internal secrets" ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)). Any local process can connect while the port is open.
- **Scope.** By default the agent "can only interact with WebContent processes" ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)).
- **Automation prefs.** On start the remote protocols set "a range of preferences deemed suitable in automation", such as disabling auto-updates. `remote.prefs.recommended=false` skips this. User-set prefs take precedence ([Remote protocol preferences](https://firefox-source-docs.mozilla.org/remote/Prefs.html)). This matters when the flag is used on a daily profile.
- **Marionette.** geckodriver's `--connect-existing` attaches to a running Firefox. "The existing Firefox instance must have Marionette enabled. To enable the remote protocol in Firefox, you can pass the `--marionette` flag." Default port 2828 ([geckodriver flags](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html)).
- **Sign-in.** It is the owner's own profile, so the session is already there. That is the only option that reuses the Zen session.
- **What it reads and blocks, per spec.** `network.RequestData` carries `method` and `url`. `network.addIntercept` blocks requests in the `beforeRequestSent` phase. `network.failRequest` "fails a fetch that's blocked by a network intercept". `network.getData` retrieves collected request or response data. `script.addPreloadScript` adds a script that runs before page scripts ([WebDriver BiDi spec](https://w3c.github.io/webdriver-bidi/)). Which of these Firefox ships was not verified.
- **Setup cost.** High. Playwright cannot be the client ([Playwright browsers](https://playwright.dev/docs/browsers)). No primary source for a maintained BiDi MCP server was found. A client would have to be written and maintained in this repo.

## 2. Enforcement

### 2.1 Blocking every request that is not a GET

**Playwright MCP has no built-in method filter.** The option table and config schema list origin filters only (PMCP README, "Configuration", "Configuration file schema"). The method filter has to be added through `--init-page`.

How the pieces fit, all from primary sources:

- `--init-page` takes a "path to TypeScript file to evaluate on Playwright page object". The README example exports `async ({ page }) => { ... }` (PMCP README, "Initial state"). The server calls that function for each tab it tracks ([tab.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/tab.ts), `_initialize`).
- `browserContext.route()` modifies "network requests that are made by any page in the browser context" ([BrowserContext.route](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)). The handler "runs before the network stack has processed the request" ([Network](https://playwright.dev/docs/network)).
- `request.method()` returns "Request's method (GET, POST, etc.)". `route.abort()` "aborts the route's request" ([Request](https://playwright.dev/docs/api/class-request), [Route](https://playwright.dev/docs/api/class-route)).
- Navigation requests are requests too (`request.isNavigationRequest()`, [Request](https://playwright.dev/docs/api/class-request)). A form post is a navigation request with method POST, so the same handler sees it.
- Handler order: "they run in the order opposite to their registration". `route.fallback()` passes the request to the earlier handlers. `route.continue()` sends it straight out ([Route.fallback](https://playwright.dev/docs/api/class-route#route-fallback)). The method guard must call `fallback()` for GET, or it bypasses the origin allowlist that the server registered earlier.
- WebSockets are a separate hook. `routeWebSocket` exists since v1.48. "By default, the routed WebSocket will not connect to the server." "Only WebSockets created after this method was called will be routed" ([BrowserContext.routeWebSocket](https://playwright.dev/docs/api/class-browsercontext#browser-context-route-web-socket), [WebSocketRoute](https://playwright.dev/docs/api/class-websocketroute)).
- Service workers: "`browserContext.route()` will not intercept requests intercepted by Service Worker." Playwright recommends `serviceWorkers: 'block'` ([BrowserContext.route](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)). Playwright MCP exposes this as `--block-service-workers`, which sets `contextOptions.serviceWorkers = 'block'` (PMCP README; [config.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/mcp/config.ts)).

A sketch of the guard. Not run.

```ts
// read-only.init-page.ts
const SIGN_IN_ORIGINS = ["https://login.example-idp.com"]; // identity provider only

export default async ({ page }) => {
  const context = page.context();
  await context.route("**/*", (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "GET" || method === "HEAD") return route.fallback();
    if (SIGN_IN_ORIGINS.includes(new URL(request.url()).origin)) return route.fallback();
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, (ws) => ws.close());
};
```

Server flags to go with it: `--init-page <file> --block-service-workers --allowed-origins "<site>;<idp>;<cdn>"`.

Two consequences of this design (reasoning, not sourced):

- Sign-in posts forms to the identity provider. A guard with no exemption blocks sign-in.
- Many sites read data with POST (GraphQL, batch query endpoints). The guard blocks those reads. Fixtures for such endpoints need another capture path, such as a HAR exported by the owner.

**Claude in Chrome.** No request filter is documented in the Claude Code docs or the support articles cited in 1.4.

**WebDriver BiDi.** Per spec, a client can subscribe to `network.beforeRequestSent`, add an intercept, and call `network.failRequest` for each request whose `method` is not GET ([WebDriver BiDi spec](https://w3c.github.io/webdriver-bidi/)). No ready-made tool does this.

**A WebExtension inside Zen** is a further way to enforce at the network level in the daily browser. `webRequest.onBeforeRequest` with `"blocking"` can return `{cancel: true}`, and its `details.method` is the HTTP method ([MDN onBeforeRequest](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest)). `webRequest.filterResponseData` lets an extension "monitor and modify the response" ([MDN filterResponseData](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/filterResponseData)). This blocks the owner's own writes too while it is switched on, and it still needs a channel to the agent.

### 2.2 Origin allowlists

- **Playwright MCP.** `--allowed-origins`: "semicolon-separated list of TRUSTED origins to allow the browser to request. Default is to allow all. Important: _does not_ serve as a security boundary and _does not_ affect redirects." `--blocked-origins` is evaluated first (PMCP README). Formats: full origin, or wildcard port (PMCP README, config schema `network`).
- Implementation: one context route that aborts `**` with `blockedbyclient`, then one `route.continue()` per allowed origin ([context.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/context.ts), `_setupRequestInterception`). It is the same routing mechanism as the method guard and has the same gaps.
- The README states: "Playwright MCP is **not** a security boundary" (PMCP README, "Security").
- **Claude in Chrome.** Per-site permissions in the extension. Admins can "restrict which websites Claude is allowed to access using allowlists and blocklists" ([getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)). These govern which sites Claude acts on. They are not described as request filters.
- **Firefox Remote Agent.** `--remote-allow-origins` and `--remote-allow-hosts` restrict who may connect to the agent. They do not restrict what the browser requests ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)).

### 2.3 Tool-level enforcement in Claude Code

- "Permission rules are enforced by Claude Code, not by the model." Rules are evaluated "deny, then ask, then allow". A deny from any settings scope wins over an allow ([Claude Code permissions](https://code.claude.com/docs/en/permissions)).
- MCP rule syntax: `mcp__<server>__<tool>` for one tool, `mcp__<server>__*` for all. A bare tool-name deny "removes the tool from Claude's context entirely" ([Claude Code permissions](https://code.claude.com/docs/en/permissions)).
- `mcp__` rules with parentheses are skipped in settings files. Parameter matching on MCP tools needs `--disallowedTools` or a PreToolUse hook ([Claude Code permissions](https://code.claude.com/docs/en/permissions)).
- The Playwright MCP tool list marks each tool `Read-only: true` or `false` (PMCP README, tool list). That flag is metadata in the README. No server option that restricts the server to read-only tools is listed.
- Read-only tools: `browser_snapshot`, `browser_find`, `browser_console_messages`, `browser_network_requests`, `browser_network_request`, `browser_take_screenshot`.
- Tools to deny for a read-only session: `browser_click`, `browser_type`, `browser_fill_form`, `browser_press_key`, `browser_select_option`, `browser_drag`, `browser_drop`, `browser_hover`, `browser_file_upload`, `browser_handle_dialog`, `browser_run_code_unsafe`. Do not enable `--caps=network`, `--caps=storage`, or `--caps=vision`. They add `browser_route`, `browser_unroute`, cookie writers, and coordinate clicks (PMCP README, tool list).
- `browser_run_code_unsafe` "executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent" (PMCP README). It has the `page` object, so it can remove routes. Deny it.
- `browser_navigate` and `browser_evaluate` are marked `Read-only: false` but are needed. Navigation is a GET. `browser_evaluate` is the only tool that returns markup. That is why the network layer is needed next to the tool layer.

## 3. What the agent can capture

With Playwright MCP (PMCP README, tool list; [network.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/network.ts)):

- **Page structure.** `browser_snapshot` returns an accessibility snapshot. It is the basis for element refs. It does not carry class names or attributes for CSS selectors.
- **Markup.** `browser_evaluate` runs a function on the page or on one element and can write the result to a file through `filename`. `el => el.outerHTML` returns the markup that a fixture needs.
- **Request list.** `browser_network_requests` lists requests since page load. It takes a URL regexp `filter` and an `all` flag for the whole session.
- **JSON responses.** `browser_network_request` returns "full details (headers and body) of a single network request". `part` selects `request-headers`, `request-body`, `response-headers`, or `response-body`. `filename` writes the result to a file in the workspace.
- **Redaction.** `--redact-url-params` replaces named URL parameter values with `<redacted>` in tool responses. `--secrets` masks values from a dotenv file. The config schema calls secrets masking "a convenience and not a security feature" (PMCP README).
- **Scrubbing is the agent's job.** Response bodies arrive unfiltered. Headers include cookies and tokens. Capture bodies, drop headers, and scrub before writing a fixture.
- **What is missing under the method guard.** Responses to POST reads are never produced, because the request is aborted (section 2.1).

With Claude in Chrome: console output, network requests, and DOM state are readable ([getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)). The full tool list is only shown in a session under `/mcp` ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)). Response-body access is not documented.

With WebDriver BiDi: `network.getData` returns bytes for `dataType` `request` or `response` ([WebDriver BiDi spec](https://w3c.github.io/webdriver-bidi/)).

## 4. Zen or a second browser

- Zen's codebase "is derived from Firefox" ([Zen FAQ](https://docs.zen-browser.app/faq)). Release builds track a Firefox version ([zen-browser/desktop README](https://github.com/zen-browser/desktop/blob/dev/README.md)).
- **Need a second browser:**
  - Playwright MCP with its own browser. Its Firefox is a patched build, and branded Firefox is unsupported ([Playwright browsers](https://playwright.dev/docs/browsers)).
  - Playwright MCP `--extension`: "Edge/Chrome only" (PMCP README).
  - Playwright MCP `--cdp-endpoint`: Chromium only, and Firefox has no CDP ([connectOverCDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp), [Remote protocol preferences](https://firefox-source-docs.mozilla.org/remote/Prefs.html)).
  - Claude in Chrome: Chromium browsers only ([Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)).
- **Can work in Zen, in principle:**
  - WebDriver BiDi through the Remote Agent, and Marionette through geckodriver (section 1.5). Both are Firefox features. Zen's docs do not mention them.
  - A WebExtension that blocks and records requests (section 2.1).
- **Cost of the second browser.** The owner signs in once more, in that browser. The scripts still have to be checked in Zen, because the look happens in a Chromium or patched-Firefox engine.

## What still gets through

### Method guard through Playwright routing

- **GET with side effects.** A method filter passes every GET. Sign-out links, "mark as read" on open, tracking, and GET-based action URLs all go out. Only a URL allowlist per site narrows this.
- **Requests handled by a service worker.** Not intercepted unless service workers are blocked ([BrowserContext.route](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)). A profile that registered a worker before the block was set may still hold it. Not verified.
- **WebSockets opened before `routeWebSocket` ran.** "Only WebSockets created after this method was called will be routed" ([BrowserContext.routeWebSocket](https://playwright.dev/docs/api/class-browsercontext#browser-context-route-web-socket)).
- **Start-up window.** The init-page function runs when the server starts tracking a tab ([tab.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/tab.ts)). Requests from a page that was already loading at that moment can precede the guard. The same applies to new isolated contexts created through `browser_tabs` (`isolatedContext` parameter, PMCP README).
- **Redirects.** The origin lists do "_not_ affect redirects" (PMCP README). Whether a redirected request passes the method guard again was not verified.
- **Code that removes the guard.** `browser_run_code_unsafe` and, with `--caps=network`, `browser_unroute` (PMCP README). Blocked only by the tool layer.
- **Requests outside the page.** Anything the agent sends from the shell with exported cookies. Blocked only by Claude Code permission rules and the sandbox.
- **The owner's own clicks** in the automated window are filtered the same way. A blocked POST fails silently from the site's point of view.
- **Other request channels** such as `navigator.sendBeacon`, WebTransport, and WebRTC. Coverage by `route` was not verified.

### Tool-level deny rules

- **`browser_evaluate` stays allowed.** It can call `element.click()`, `form.submit()`, or `fetch()` with any method. Only the network layer stops the resulting request.
- **`browser_navigate` stays allowed.** It can open any GET URL, including one with side effects.
- **Client-side state.** Evaluated code can change `localStorage`, cookies readable by script, and IndexedDB. No request is involved, so neither layer sees it.
- **Rules live in settings.** A deny rule holds only where the settings file applies. Put it in user or managed settings if it must hold in every project ([Claude Code permissions](https://code.claude.com/docs/en/permissions)).

### Origin allowlists

- Documented as no security boundary. Redirects are not covered (PMCP README).
- An allowed origin is allowed for every method. The list limits where requests go. It does not limit what they do.

### Claude in Chrome permissions

- Approval is per action or per site. "Always allow actions on this site" covers clicks and typing on that site ([permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)).
- Classifier-based protection: "The risk is not zero" ([safety article](https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely)).
- No network-level control is documented.

### Remote Agent (BiDi, Marionette)

- The port has no authentication. Every local process gets full control of the daily browser while it is open ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)).
- Read-only depends entirely on the client that is written. The protocol itself allows input simulation and cookie access ([Remote Agent security](https://firefox-source-docs.mozilla.org/remote/Security.html)).
- Whether `network.addIntercept` covers WebSocket traffic was not established from the spec text.

## Unverified

- **Nothing was run.** The init-page sketch, the flag combination, and the deny rules are assembled from docs and source. Test them against a harmless site first: a POST form, a `fetch` POST, a WebSocket, and a service worker.
- Whether a `context.route()` registered from `--init-page` is in place before the first request of every new tab, popup, and isolated context.
- Whether `--init-page`, `--init-script`, `--allowed-origins`, and `--block-service-workers` take effect in `--extension` and `--cdp-endpoint` modes. The source applies route setup to the default context in all modes, but `connectOverCDP` is documented as lower fidelity.
- Whether Playwright routing sees `navigator.sendBeacon`, CORS preflights, WebTransport, and redirected requests.
- Whether company SSO accepts the Playwright-launched browser. Conditional-access rules such as device compliance or managed-browser checks could reject it. No primary source covers this.
- Which browser `@playwright/mcp` launches when `--browser` is not set, and whether the installed version matches the README on `main`.
- Whether Violentmonkey loads in the Playwright MCP persistent profile.
- Whether Zen honours `--remote-debugging-port` and `--marionette`. Zen's docs are silent. It follows from the Firefox base only.
- Which WebDriver BiDi network commands Firefox ships (`addIntercept`, `failRequest`, `getData`). The MDN module page lists no commands and its compatibility table did not load.
- Whether a maintained MCP server for Firefox BiDi exists. None was found in primary sources. No search of package registries was done.
- Whether Claude in Chrome exposes response bodies, and its exact tool names. The docs point to `/mcp` in a live session.
- The disagreement between the Claude Code docs (Brave, Arc, Vivaldi, Opera work) and the support article (other Chromium browsers unsupported).
- Whether a WebExtension's `webRequest` listener in Firefox sees WebSocket handshakes and service-worker requests. The MDN pages fetched do not say.
- A manual path was not researched: the owner exports a HAR and copies markup from Zen's developer tools, and the agent scrubs the files.
